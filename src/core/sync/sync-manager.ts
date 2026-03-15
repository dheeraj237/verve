/**
 * SyncManager — simplified v2
 *
 * Responsibilities:
 *  - One IAdapter per workspace (LocalAdapter or BrowserAdapter)
 *  - mountWorkspace: destroy old adapter, create new one, pull, subscribe to dirty files
 *  - unmountWorkspace: destroy adapter, cancel pending debounce timers
 *  - Per-file 2s debounce push with max-3 exponential retry (2s → 5s → 10s)
 *  - start(): subscribe to activeWorkspaceId changes in the workspace store
 *  - stop(): tear everything down
 *
 * No RxJS, no AdapterRegistry, no FileSyncQueue, no legacy API surface.
 */

import { useWorkspaceStore } from '@/core/store/workspace-store';
import {
  markCachedFileAsSynced,
  subscribeToDirtyWorkspaceFiles,
  getFileNodeWithContent,
  updateSyncStatus,
} from '@/core/cache/file-manager';
import type { FileNode } from '@/shared/types';
import type { IAdapter } from './adapter';
import { LocalAdapter, BrowserAdapter } from './adapters';

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
}

// Retry delays for push failures: attempt 0→2s, 1→5s, 2→10s
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const PUSH_DEBOUNCE_MS = 2_000;
const MAX_RETRIES = 3;

export class SyncManager {
  private static _instance: SyncManager | null = null;

  private readonly _adapters = new Map<string, IAdapter>();
  private _activeWorkspaceId: string | null = null;
  private readonly _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _retryCount = new Map<string, number>();
  private _dirtySub: (() => void) | null = null;
  private _workspaceSub: (() => void) | null = null;

  private constructor() {}

  static getInstance(): SyncManager {
    if (!SyncManager._instance) {
      SyncManager._instance = new SyncManager();
    }
    return SyncManager._instance;
  }

  /**
   * Subscribes to workspace store changes and mounts the currently active workspace.
   * Call once at app startup.
   */
  start(): void {
    if (this._workspaceSub) return; // already running

    // Use the standard two-argument subscribe(listener) API so this works without
    // the subscribeWithSelector middleware. The two-arg selector form is silently
    // broken in vanilla Zustand — the callback would never fire.
    this._workspaceSub = useWorkspaceStore.subscribe((state, prevState) => {
      if (state.activeWorkspaceId !== prevState.activeWorkspaceId) {
        const newId = state.activeWorkspaceId;
        if (newId) this.mountWorkspace(newId, this._resolveType(newId));
      }
    });

    const currentId = useWorkspaceStore.getState().activeWorkspaceId;
    if (currentId) {
      this.mountWorkspace(currentId, this._resolveType(currentId));
    }
  }

  /**
   * Tear down all subscriptions, destroy all adapters, cancel all timers.
   */
  stop(): void {
    this._workspaceSub?.();
    this._workspaceSub = null;

    this._dirtySub?.();
    this._dirtySub = null;

    for (const id of this._debounceTimers.values()) clearTimeout(id);
    this._debounceTimers.clear();
    this._retryCount.clear();

    for (const adapter of this._adapters.values()) adapter.destroy();
    this._adapters.clear();

    this._activeWorkspaceId = null;
  }

  /**
   * Creates the right adapter for workspaceId, pulls fresh data into RxDB,
   * and sets up the dirty-file subscription for ongoing push.
   * Replaces any previously mounted adapter for this workspace.
   */
  async mountWorkspace(
    workspaceId: string,
    type: 'local' | 'browser',
  ): Promise<void> {
    // Destroy existing adapter for this workspace (if any)
    const existing = this._adapters.get(workspaceId);
    if (existing) {
      existing.destroy();
      this._adapters.delete(workspaceId);
    }

    // Cancel dirty-file timers that belong to the outgoing active workspace
    if (this._activeWorkspaceId && this._activeWorkspaceId !== workspaceId) {
      this._cancelWorkspaceTimers(this._activeWorkspaceId);
    }

    // Create fresh adapter
    const adapter: IAdapter =
      type === 'local'
        ? new LocalAdapter(workspaceId)
        : new BrowserAdapter(workspaceId);

    this._adapters.set(workspaceId, adapter);
    this._activeWorkspaceId = workspaceId;

    try {
      await adapter.pull();
    } catch (err: any) {
      if (err?.name === 'PermissionError') {
        useWorkspaceStore.getState().setPermissionNeeded?.(workspaceId, true);
      } else {
        console.error('[SyncManager] pull() failed for workspace', workspaceId, err);
      }
    }

    // Tear down previous dirty-file subscription
    this._dirtySub?.();
    this._dirtySub = null;

    if (this._activeWorkspaceId !== workspaceId) return;

    this._dirtySub = subscribeToDirtyWorkspaceFiles(
      workspaceId,
      (files: FileNode[]) => {
        for (const file of files) {
          if (file.dirty) this._schedulePush(file, workspaceId);
        }
      },
    );
  }

  /**
   * Ensures filesystem permission for a local workspace, showing the directory
   * picker if no handle exists. Must be called from a user-gesture handler.
   * If permission is granted, triggers a full mountWorkspace pull.
   */
  async requestPermission(workspaceId: string): Promise<boolean> {
    let adapter = this._adapters.get(workspaceId);
    if (!adapter || adapter.type !== 'local') {
      adapter = new LocalAdapter(workspaceId);
      this._adapters.set(workspaceId, adapter);
    }
    const granted = await (adapter as LocalAdapter).ensurePermission();
    if (granted) {
      useWorkspaceStore.getState().setPermissionNeeded?.(workspaceId, false);
      await this.mountWorkspace(workspaceId, 'local');
    }
    return granted;
  }

  /**
   * Unmount a workspace: destroy its adapter and cancel its pending timers.
   * Call before workspace deletion.
   */
  unmountWorkspace(workspaceId: string): void {
    this._adapters.get(workspaceId)?.destroy();
    this._adapters.delete(workspaceId);
    this._cancelWorkspaceTimers(workspaceId);
  }

  /**
   * Schedules a debounced push for a dirty file, then runs _executePush.
   * Re-scheduling cancels any existing timer for the same fileId.
   */
  private _schedulePush(
    file: FileNode,
    workspaceId: string,
    delayMs = PUSH_DEBOUNCE_MS,
  ): void {
    const fileId = file.id;

    const existing = this._debounceTimers.get(fileId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this._debounceTimers.delete(fileId);
      await this._executePush(file, workspaceId);
    }, delayMs);

    this._debounceTimers.set(fileId, timer);
  }

  private async _executePush(file: FileNode, workspaceId: string): Promise<void> {
    const fileId = file.id;
    const adapter = this._adapters.get(workspaceId);

    if (!adapter || this._activeWorkspaceId !== workspaceId) {
      return;
    }

    try {
      const node = await getFileNodeWithContent(fileId);
      if (!node) return;

      await adapter.push(node.path, node.content ?? '');
      await markCachedFileAsSynced(fileId);
      this._retryCount.delete(fileId);
    } catch (err) {
      const attempts = (this._retryCount.get(fileId) ?? 0) + 1;
      this._retryCount.set(fileId, attempts);

      if (attempts < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        console.warn(
          `[SyncManager] push failed for ${fileId} (attempt ${attempts}), retrying in ${delay}ms`,
          err,
        );
        this._schedulePush(file, workspaceId, delay);
      } else {
        console.error(
          `[SyncManager] push permanently failed for ${fileId} after ${attempts} attempts`,
          err,
        );
        this._retryCount.delete(fileId);
        await updateSyncStatus(fileId, 'error', file.version ?? 0);
      }
    }
  }

  /** Resolves the workspace type from the store, defaulting to 'browser'. */
  private _resolveType(workspaceId: string): 'local' | 'browser' {
    const ws = useWorkspaceStore
      .getState()
      .workspaces?.find((w: any) => w.id === workspaceId);
    return ws?.type === 'local' ? 'local' : 'browser';
  }

  /** Cancel all pending push timers whose fileId is workspace-scoped. */
  private _cancelWorkspaceTimers(workspaceId: string): void {
    for (const [fileId, timer] of this._debounceTimers.entries()) {
      if (fileId.startsWith(`${workspaceId}:`)) {
        clearTimeout(timer);
        this._debounceTimers.delete(fileId);
        this._retryCount.delete(fileId);
      }
    }
  }
}

/** Returns the global singleton SyncManager, creating it on first call. */
export function getSyncManager(): SyncManager {
  return SyncManager.getInstance();
}

/** Stops the global SyncManager and tears down all adapters. */
export function stopSyncManager(): void {
  SyncManager.getInstance().stop();
}

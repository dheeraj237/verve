import { BehaviorSubject, Observable, interval } from 'rxjs';
import { throttleTime, distinctUntilChanged } from 'rxjs/operators';
import * as Y from 'yjs';
import {
  getCacheDB,
  getCachedFile,
  getCrdtDoc,
  getDirtyCachedFiles,
  markCachedFileAsSynced,
  observeCachedFiles,
  upsertCachedFile
} from '../cache';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import type { CachedFile, CrdtDoc } from '../cache/types';

/**
 * Sync adapter interface for pushing/pulling changes from remote sources
 * Adapters are only used for non-browser workspaces (local, gdrive, s3, etc.)
 * Browser workspaces have no sync adapter (purely local IndexedDB)
 * 
 * Implementations: LocalAdapter, GDriveAdapter, (future) S3Adapter
 */
export interface ISyncAdapter {
  name: string;
  /**
   * Push local changes to remote
   * Returns true if successful
   */
  push(file: CachedFile, yjsState: Uint8Array): Promise<boolean>;

  /**
   * Pull remote changes
   * Returns null if not found, or the remote Yjs state
   */
  pull(fileId: string, localVersion?: number): Promise<Uint8Array | null>;

  /**
   * Check if a file exists remotely
   */
  exists(fileId: string): Promise<boolean>;

  /**
   * Delete a file remotely
   */
  delete(fileId: string): Promise<boolean>;

  /**
   * Watch for remote changes (optional)
   * Should emit file IDs that changed
   */
  watch?(): Observable<string>;
}

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error'
}

export interface SyncStats {
  totalSynced: number;
  totalFailed: number;
  lastSyncTime: number;
  upcomingSyncFiles: string[];
}

/**
 * Central SyncManager orchestrates multi-adapter sync
 * Watches RxDB for dirty files, coordinates with adapters,
 * and merges remote changes back to CRDT docs
 */
export class SyncManager {
  private adapters: Map<string, ISyncAdapter> = new Map();
  private statusSubject = new BehaviorSubject<SyncStatus>(SyncStatus.IDLE);
  private statsSubject = new BehaviorSubject<SyncStats>({
    totalSynced: 0,
    totalFailed: 0,
    lastSyncTime: 0,
    upcomingSyncFiles: []
  });

  private syncInterval = 5000; // 5 seconds
  private isRunning = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private maxRetries = 3;
  private retryDelays = [1000, 3000, 5000]; // exponential backoff

  constructor(private batchSize = 5) {}

  /**
   * Register a sync adapter (e.g., local, GDrive, browser storage)
   */
  registerAdapter(adapter: ISyncAdapter): void {
    this.adapters.set(adapter.name, adapter);
    console.log(`Registered sync adapter: ${adapter.name}`);
  }

  /**
   * Get a registered adapter by name
   */
  getAdapter(name: string): ISyncAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Start the sync manager (begins polling)
   */
  start(): void {
    if (this.isRunning) {
      console.warn('SyncManager already running');
      return;
    }

    this.isRunning = true;
    this.statusSubject.next(SyncStatus.IDLE);

    // Start periodic sync and remote change monitoring
    this.startPolling();
    this.setupRemoteWatchers();

    console.log('SyncManager started');
  }

  /**
   * Stop the sync manager
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.statusSubject.next(SyncStatus.IDLE);
    console.log('SyncManager stopped');
  }

  /**
   * Observable for sync status changes
   */
  status$(): Observable<SyncStatus> {
    return this.statusSubject.asObservable();
  }

  /**
   * Observable for sync statistics
   */
  stats$(): Observable<SyncStats> {
    return this.statsSubject.asObservable().pipe(
      throttleTime(1000),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    );
  }

  /**
   * Manually trigger a sync cycle
   */
  async syncNow(): Promise<void> {
    if (!this.isRunning) {
      console.warn('SyncManager not running');
      return;
    }

    this.statusSubject.next(SyncStatus.SYNCING);
    try {
      await this.performSync();
      this.statusSubject.next(SyncStatus.ONLINE);
    } catch (error) {
      console.error('Sync failed:', error);
      this.statusSubject.next(SyncStatus.ERROR);
    }
  }

  /**
   * Start polling for dirty files and sync them
   */
  private startPolling(): void {
    // Run sync immediately, then periodically
    this.performSync().catch((error) => {
      console.error('Initial sync failed:', error);
    });

    this.pollInterval = setInterval(() => {
      if (this.isRunning) {
        this.performSync().catch((error) => {
          console.error('Periodic sync failed:', error);
        });
      }
    }, this.syncInterval);
  }

  /**
   * Core sync logic: find dirty files, push to adapters, pull remote changes
   */
  private async performSync(): Promise<void> {
    try {
      const dirtyFiles = await getDirtyCachedFiles();

      if (dirtyFiles.length === 0) {
        return; // Nothing to sync
      }

      // Filter out browser-only workspaces (they don't need sync)
      const filesToSync = dirtyFiles.filter((file) => file.workspaceType !== 'browser');

      if (filesToSync.length === 0) {
        return; // Only browser files, nothing to sync
      }

      // Process in batches
      for (let i = 0; i < filesToSync.length; i += this.batchSize) {
        const batch = filesToSync.slice(i, i + this.batchSize);
        await Promise.allSettled(batch.map((file) => this.syncFile(file)));
      }

      const stats = this.statsSubject.value;
      stats.lastSyncTime = Date.now();
      this.statsSubject.next(stats);
    } catch (error) {
      console.error('performSync error:', error);
    }
  }

  /**
   * Sync a single file: push local, pull remote, merge if needed
   */
  private async syncFile(file: CachedFile): Promise<void> {
    const { id: fileId, crdtId } = file;

    if (!crdtId) {
      console.warn(`File ${fileId} has no CRDT ID, skipping sync`);
      return;
    }

    try {
      // Get current CRDT state
      const crdtDoc = await getCrdtDoc(crdtId);
      if (!crdtDoc) {
        console.warn(`CRDT doc ${crdtId} not found for file ${fileId}`);
        return;
      }

      // Get Yjs state (binary)
      let yjsState: Uint8Array;
      if (typeof crdtDoc.yjsState === 'string') {
        yjsState = new Uint8Array(Buffer.from(crdtDoc.yjsState, 'base64'));
      } else {
        yjsState = crdtDoc.yjsState || new Uint8Array();
      }

      // Try to push to each adapter
      let pushed = false;
      for (const adapter of this.adapters.values()) {
        try {
          const success = await this.pushWithRetry(adapter, file, yjsState);
          if (success) {
            pushed = true;
            break; // Success, don't try other adapters
          }
        } catch (error) {
          console.warn(`Failed to push to ${adapter.name}:`, error);
        }
      }

      if (pushed) {
        // Mark as synced
        await markCachedFileAsSynced(fileId);

        const stats = this.statsSubject.value;
        stats.totalSynced++;
        this.statsSubject.next(stats);
      }

      // Try to pull from each adapter (merge remote changes)
      for (const adapter of this.adapters.values()) {
        try {
          const remoteState = await adapter.pull(fileId);
          if (remoteState) {
            await this.mergeRemoteChanges(crdtId, remoteState);
          }
        } catch (error) {
          console.warn(`Failed to pull from ${adapter.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`syncFile error for ${fileId}:`, error);

      const stats = this.statsSubject.value;
      stats.totalFailed++;
      this.statsSubject.next(stats);
    }
  }

  /**
   * Push file to adapter with retries
   */
  private async pushWithRetry(
    adapter: ISyncAdapter,
    file: CachedFile,
    yjsState: Uint8Array
  ): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const success = await adapter.push(file, yjsState);
        if (success) return true;
      } catch (error) {
        console.warn(`Push attempt ${attempt + 1} failed:`, error);

        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelays[attempt] || 5000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    return false;
  }

  /**
   * Merge remote Yjs state with local CRDT doc
   * Yjs automatically handles conflict resolution via CRDT
   */
  private async mergeRemoteChanges(crdtId: string, remoteState: Uint8Array): Promise<void> {
    try {
      const crdtDoc = await getCrdtDoc(crdtId);
      if (!crdtDoc) return;

      // Create a temporary Y.Doc to apply remote state
      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, remoteState);

      // Apply remote state to the stored state
      let currentState: Uint8Array;
      if (typeof crdtDoc.yjsState === 'string') {
        currentState = new Uint8Array(Buffer.from(crdtDoc.yjsState, 'base64'));
      } else {
        currentState = crdtDoc.yjsState || new Uint8Array();
      }

      // Create a doc with current state
      const localDoc = new Y.Doc();
      Y.applyUpdate(localDoc, currentState);

      // Apply remote updates to local doc (CRDT merge)
      Y.applyUpdate(localDoc, remoteState);

      // Save merged state
      const mergedState = Y.encodeStateAsUpdate(localDoc);
      const mergedStateBase64 = Buffer.from(mergedState).toString('base64');

      await upsertCachedFile({
        ...crdtDoc,
        yjsState: mergedStateBase64,
        lastUpdated: Date.now()
      } as any);

      console.log(`Merged remote changes for CRDT ${crdtId}`);
    } catch (error) {
      console.error(`mergeRemoteChanges error for ${crdtId}:`, error);
    }
  }

  /**
   * Setup watchers for remote changes
   * Adapters can emit change notifications via their watch() observable
   */
  private setupRemoteWatchers(): void {
    for (const adapter of this.adapters.values()) {
      if (adapter.watch) {
        try {
          const watcher = adapter.watch();
          watcher.subscribe(
            (changedFileId) => {
              console.log(`Remote change detected in ${adapter.name}: ${changedFileId}`);
              // Trigger pull for this file
              this.pullFileFromAdapter(changedFileId, adapter).catch((error) => {
                console.error(`Failed to pull ${changedFileId} from ${adapter.name}:`, error);
              });
            },
            (error) => {
              console.error(`Watch error in ${adapter.name}:`, error);
            }
          );
        } catch (error) {
          console.warn(`Failed to setup watcher for ${adapter.name}:`, error);
        }
      }
    }
  }

  /**
   * Pull a specific file's changes from an adapter and merge
   */
  private async pullFileFromAdapter(fileId: string, adapter: ISyncAdapter): Promise<void> {
    try {
      const workspace = useWorkspaceStore.getState().activeWorkspace?.();
      const workspaceId = workspace?.id;

      const file = await getCachedFile(fileId, workspaceId);
      if (!file || !file.crdtId) return;

      const remoteState = await adapter.pull(fileId);
      if (remoteState) {
        await this.mergeRemoteChanges(file.crdtId, remoteState);
      }
    } catch (error) {
      console.error(`pullFileFromAdapter error:`, error);
    }
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

/**
 * Get or create the global SyncManager instance
 */
export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}

/**
 * Initialize and start the SyncManager
 */
export async function initializeSyncManager(adapters: ISyncAdapter[]): Promise<SyncManager> {
  const manager = getSyncManager();
  for (const adapter of adapters) {
    manager.registerAdapter(adapter);
  }
  manager.start();
  return manager;
}

/**
 * Cleanup: stop the SyncManager
 */
export function stopSyncManager(): void {
  if (syncManagerInstance) {
    syncManagerInstance.stop();
  }
}

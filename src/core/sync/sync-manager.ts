/**
 * Sync Manager - Refactored with Java-Style OOP
 * 
 * Key improvements:
 * - Private singleton constructor (enforce getInstance pattern)
 * - Adapters are destroyed/recreated per workspace (not global singletons)
 * - Immutable adapter configuration objects
 * - Lifecycle state machine for adapters (UNINITIALIZED -> READY/ERRORED)
 * - Event-driven retry logic (instead of polling isReady())
 * - Immutable file sync queue (preserved across workspace switches)
 * - Explicit workspace binding: adapter.workspaceId never null or changed
 * 
 * The root issue being fixed:
 * - Old: LocalAdapter.setCurrentWorkspace() was defined but NEVER called
 *   Result: adapter.currentWorkspaceId always null, isReady() always false
 * - New: Adapter bound to workspace in constructor, immutable, guaranteed valid
 */

import { BehaviorSubject, Observable } from 'rxjs';
import { throttleTime, distinctUntilChanged } from 'rxjs/operators';

import {
  getCacheDB,
  getCachedFile,
  markCachedFileAsSynced,
  subscribeToDirtyWorkspaceFiles,
  upsertCachedFile,
  loadFile,
  saveFile,
  queryDirtyFiles,
  getFileNodeWithContent,
  saveFileNode,
  updateSyncStatus,
} from '../cache';

import type { ISyncAdapter } from './adapter-types';
import {
  AdapterState,
  AdapterInitError,
  AdapterInitContext,
  AdapterErrorCode,
  AdapterReadinessInfo,
  AdapterLifecycleEvent,
} from './types/adapter-lifecycle';
import { FileSyncQueue, FileSyncQueueEntry } from './file-sync-queue';
import { AdapterRegistry } from './adapter-registry';
import { MergeStrategy, NoOpMergeStrategy } from './merge-strategies';
import { v4 as uuidv4 } from 'uuid';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType, FileType } from '@/core/cache/types';
import type { FileNode } from '@/shared/types';
import { toAdapterDescriptor } from './adapter-types';
import { pushCachedFile } from './adapter-bridge';
import { fileNodeBridge } from './file-node-bridge';
import { adapterEntryToCachedFile } from './adapter-normalize';

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
}

export interface SyncStats {
  totalSynced: number;
  totalFailed: number;
  lastSyncTime: number;
  upcomingSyncFiles: string[];
}

/**
 * Java-style Singleton SyncManager with strict initialization patterns.
 * 
 * Private constructor ensures only one instance exists.
 * Workspace-aware adapter lifecycle management.
 * Event-driven sync retry logic.
 */
export class SyncManager {
  // Singleton instance holder
  private static instance: SyncManager | null = null;

  // Core state - immutable references with observable properties
  private readonly adapters: Map<string, ISyncAdapter> = new Map();
  private readonly adaptersByWorkspace: Map<string, ISyncAdapter> = new Map();
  private readonly adapterEventListeners: Map<string, Set<(event: AdapterLifecycleEvent) => void>> =
    new Map();

  // Queue preserved across workspace switches
  private readonly fileQueue: FileSyncQueue;

  // Observable state
  private readonly statusSubject = new BehaviorSubject<SyncStatus>(SyncStatus.IDLE);
  private readonly statsSubject = new BehaviorSubject<SyncStats>({
    totalSynced: 0,
    totalFailed: 0,
    lastSyncTime: 0,
    upcomingSyncFiles: [],
  });

  // Lifecycle
  private isRunning = false;
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 3000, 5000]; // 1s, 3s, 5s
  private readonly retryMap: Map<string, { attempts: number; timer: ReturnType<typeof setTimeout> | null }> =
    new Map();
  private cachedFilesSub: any = null;
  private workspaceSub: any = null;
  private activeWorkspaceId: string | null = null;
  private mergeStrategy: MergeStrategy = new NoOpMergeStrategy();
  private pullAfterPush = false; // Safety switch: disabled for now
  private readonly registry: AdapterRegistry;

  /**
   * Private constructor - enforces singleton pattern.
   * Use getInstance() to get the single instance.
   */
  private constructor(batchSize: number = 5, maxQueueRetries: number = 3) {
    this.fileQueue = new FileSyncQueue(maxQueueRetries);
    this.registry = AdapterRegistry.getInstance();
    console.log('[SyncManager] ✓ Singleton instance created (private constructor)');
  }

  /**
   * Get or create the global SyncManager singleton.
   * Java-style: thread-safe (JavaScript is single-threaded, pattern applies).
   */
  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  // ============================================================================
  // PUBLIC API: Initialization & Lifecycle
  // ============================================================================

  /**
   * Start the SyncManager and subscribe to workspace changes.
   * Sets up dirty file monitoring for the active workspace.
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[SyncManager] Already running, skipping start');
      return;
    }

    this.isRunning = true;
    this.statusSubject.next(SyncStatus.IDLE);
    console.log('[SyncManager] ✓ Status set to IDLE');

    try {
      console.log('[SyncManager] Setting up workspace change subscription...');

      this.workspaceSub = (useWorkspaceStore.subscribe as any)(
        (s) => s.activeWorkspaceId,
        async (newId: string | null) => {
          console.log(`[SyncManager] 📋 Workspace changed to: "${newId}"`);
          await this.setupDirtyFilesSubscription(newId);
        }
      );

      const currentWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      console.log(`[SyncManager] Initializing with current workspace: "${currentWorkspaceId}"`);
      this.setupDirtyFilesSubscription(currentWorkspaceId);

      console.log('[SyncManager] ✓ Workspace subscription registered');
    } catch (err) {
      console.error('[SyncManager] ❌ Failed to subscribe to workspace changes:', err);
    }

    console.log('[SyncManager] ✅ SyncManager started successfully (isRunning=true)');
  }

  /**
   * Stop the SyncManager - clean up subscriptions and destroy all adapters.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[SyncManager] Not running, skipping stop');
      return;
    }

    console.log('[SyncManager] ⏹️  Stopping SyncManager...');
    this.isRunning = false;

    // Teardown subscriptions
    if (this.cachedFilesSub) {
      try {
        if (typeof this.cachedFilesSub === 'function') {
          this.cachedFilesSub();
        } else if (typeof this.cachedFilesSub.unsubscribe === 'function') {
          this.cachedFilesSub.unsubscribe();
        }
      } catch (e) {
        console.warn('[SyncManager] Error unsubscribing from dirty files:', e);
      }
    }

    if (this.workspaceSub) {
      try {
        if (typeof this.workspaceSub === 'function') {
          this.workspaceSub();
        }
      } catch (e) {
        console.warn('[SyncManager] Error unsubscribing from workspace changes:', e);
      }
    }

    // Clear retry timers
    for (const retry of this.retryMap.values()) {
      if (retry.timer) {
        clearTimeout(retry.timer);
      }
    }
    this.retryMap.clear();

    // Destroy all adapters
    for (const [workspaceId, adapter] of this.adaptersByWorkspace.entries()) {
      try {
        console.log(`[SyncManager] Destroying adapter for workspace ${workspaceId}...`);
        await adapter.destroy();
      } catch (e) {
        console.error(`[SyncManager] Error destroying adapter for ${workspaceId}:`, e);
      }
    }

    this.adaptersByWorkspace.clear();
    this.statusSubject.next(SyncStatus.IDLE);
    console.log('[SyncManager] ✅ SyncManager stopped');
  }

  /**
   * Initialize adapter for a specific workspace.
   * 
   * Lifecycle:
   * 1. Destroy existing adapter for this workspace (if any)
   * 2. Get workspace details and adapter type
   * 3. Create new adapter via registry
   * 4. Call adapter.initialize() - async, may prompt for permissions
   * 5. Listen to adapter state changes (subscribe to ready/error events)
   * 6. Update dirty files subscription for this workspace
   * 
   * This is called on workspace creation and on workspace switch.
   */
  async initializeForWorkspace(workspaceId: string): Promise<void> {
    console.log(`[SyncManager] Initializing adapter for workspace: ${workspaceId}`);

    try {
      // 1. Destroy existing adapter for this workspace
      const existingAdapter = this.adaptersByWorkspace.get(workspaceId);
      if (existingAdapter) {
        console.log(`[SyncManager] Destroying previous adapter for workspace ${workspaceId}...`);
        try {
          await existingAdapter.destroy();
        } catch (e) {
          console.error(`[SyncManager] Error destroying previous adapter:`, e);
        }
        this.adaptersByWorkspace.delete(workspaceId);
      }

      // 2. Get workspace and resolve adapter type
      const workspace = useWorkspaceStore
        .getState()
        .workspaces?.find((ws) => ws.id === workspaceId);

      if (!workspace) {
        console.warn(`[SyncManager] Workspace not found: ${workspaceId}`);
        return;
      }

      const workspaceType = String(workspace.type || 'browser');

      // Browser workspaces don't need adapters (pure IndexedDB)
      if (workspaceType === 'browser' || workspaceType === WorkspaceType.Browser) {
        console.log(`[SyncManager] Workspace ${workspaceId} is browser type - no adapter needed`);
        return;
      }

      // 3. Check registry and create adapter
      if (!this.registry.has(workspaceType)) {
        console.warn(
          `[SyncManager] No adapter factory registered for workspace type: ${workspaceType}`
        );
        return;
      }

      // Create a config for this workspace
      const adapterConfig = {
        name: workspaceType,
        workspaceType: workspaceType as any,
        capabilities: {
          canPush: true,
          canPull: true,
          canWatch: false,
          canDelete: true,
          requiresAuth: workspaceType !== 'local',
        },
      };

      // Create new adapter instance
      const adapter = await this.registry.createAdapter(
        workspaceType,
        adapterConfig,
        { workspaceId }
      );

      // 4. Subscribe to adapter events before calling initialize
      this.subscribeToAdapterEvents(adapter, workspaceId);

      // 5. Call initialize (may be async, may emit initialization-failed event)
      console.log(`[SyncManager] Calling adapter.initialize() for workspace ${workspaceId}...`);
      await adapter.initialize({
        workspaceId,
        isUserGesture: false,
        createdAt: new Date(),
      });

      // Store adapter per workspace
      this.adaptersByWorkspace.set(workspaceId, adapter);
      console.log(
        `[SyncManager] ✓ Adapter initialized for workspace ${workspaceId}, state: ${adapter.getState()}`
      );

      // 6. Re-subscribe to dirty files for this workspace (triggers sync)
      if (this.activeWorkspaceId === workspaceId) {
        await this.setupDirtyFilesSubscription(workspaceId);
      }
    } catch (error) {
      console.error(`[SyncManager] Failed to initialize adapter for workspace ${workspaceId}:`, error);
      // Emit event for UI to show error state
      this.emitGlobalEvent({
        type: 'initialization-failed',
        error: new AdapterInitError(
          AdapterErrorCode.INITIALIZATION_FAILED,
          `Failed to initialize adapter for workspace ${workspaceId}`,
          error as Error
        ),
        timestamp: new Date(),
      });
    }
  }

  /**
   * Clean up adapter for a workspace before switch.
   * Pauses dirty file sync, may call adapter.destroy().
   * Does NOT remove from queue - syncs will resume when adapter is ready again.
   */
  async cleanupForWorkspace(workspaceId: string): Promise<void> {
    console.log(`[SyncManager] Cleaning up adapter for workspace: ${workspaceId}`);

    // Pause dirty files subscription for this workspace
    if (this.cachedFilesSub) {
      try {
        if (typeof this.cachedFilesSub === 'function') {
          this.cachedFilesSub();
        }
      } catch (e) {
        console.warn('[SyncManager] Error pausing dirty files:', e);
      }
      this.cachedFilesSub = null;
    }

    // Don't destroy the adapter here - keep it alive for later reinit
    // This allows recovery if workspace is switched back
    console.log(`[SyncManager] ✓ Cleaned up workspace ${workspaceId}`);
  }

  // ============================================================================
  // ADAPTER MANAGEMENT
  // ============================================================================

  /**
   * Get adapter for a workspace.
   */
  getAdapterForWorkspace(workspaceId: string): ISyncAdapter | undefined {
    return this.adaptersByWorkspace.get(workspaceId);
  }

  /**
   * Get adapter by registry name (backward compat).
   */
  getAdapter(name: string): ISyncAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Register a pre-created adapter (backward compat for old initialization).
   * Deprecated - prefer createAdapter() via registry.
   */
  registerAdapter(adapter: ISyncAdapter): void {
    this.adapters.set(adapter.name, adapter);
    console.log(`[SyncManager] Registered sync adapter: ${adapter.name}`);
  }

  // ============================================================================
  // SUBSCRIPTION & SYNC LOGIC
  // ============================================================================

  /**
   * Setup dirty files subscription for a specific workspace.
   * Tears down previous, creates new.
   * 
   * Listens to dirty files and initiates push for each one,
   * respecting adapter readiness.
   */
  private async setupDirtyFilesSubscription(workspaceId: string | null): Promise<void> {
    try {
      // Tear down previous
      if (this.cachedFilesSub) {
        console.log('[SyncManager] Tearing down previous dirty files subscription...');
        try {
          if (typeof this.cachedFilesSub === 'function') {
            this.cachedFilesSub();
          } else if (typeof this.cachedFilesSub.unsubscribe === 'function') {
            this.cachedFilesSub.unsubscribe();
          }
        } catch (u) {
          console.warn('[SyncManager] Error during teardown:', u);
        }
      }

      this.activeWorkspaceId = workspaceId;

      if (!workspaceId) {
        console.log('[SyncManager] No active workspace, skipping dirty files subscription');
        this.cachedFilesSub = null;
        return;
      }

      console.log(`[SyncManager] Setting up dirty files subscription for workspace: ${workspaceId}`);

      // Subscribe to dirty files for this workspace
      // Note: callback receives an array of FileNode[] (all dirty files), not individual files
      this.cachedFilesSub = subscribeToDirtyWorkspaceFiles(workspaceId, async (files: FileNode[]) => {
        // Process all dirty files
        for (const file of files) {
          if (!file.dirty) continue;

          try {
            await this.pushDirtyFile(file);
          } catch (error) {
            console.error(`[SyncManager] Error pushing file ${file.id}:`, error);
          }
        }
      });

      console.log(`[SyncManager] ✓ Dirty files subscription active for ${workspaceId}`);
    } catch (err) {
      console.error('[SyncManager] Failed to setup dirty files subscription:', err);
    }
  }

  /**
   * Push a single file to its adapter.
   * Respects adapter readiness - if not ready, enqueues for retry on state change.
   */
  private async pushDirtyFile(file: FileNode): Promise<void> {
    const fileId = file.id;

    try {
      // Skip if already synced
      if (!file.dirty) {
        return;
      }

      const fileData = await loadFile(file.path, file.workspaceType as any, file.workspaceId);
      const content = fileData?.content ?? '';

      // Get adapter for this workspace
      const adapter = this.adaptersByWorkspace.get(file.workspaceId!);
      if (!adapter) {
        console.warn(
          `[SyncManager] No adapter for workspace: ${file.workspaceId}, enqueuing retry`
        );
        this.fileQueue.enqueue(fileId, file.workspaceId!);
        return;
      }

      // Check adapter readiness
      if (!adapter.validateReady()) {
        const info = adapter.getReadinessInfo();
        console.info(
          `[SyncManager] Adapter not ready for ${file.workspaceId} (state: ${info.state}), enqueuing retry`
        );
        this.fileQueue.enqueue(fileId, file.workspaceId!);
        return;
      }

      // Push to adapter
      const descriptor = toAdapterDescriptor(file);
      const success = await adapter.push(descriptor, content);

      if (success) {
        // Mark as synced
        await markCachedFileAsSynced(fileId);
        this.fileQueue.dequeue(fileId);

        // Clear any pending retry
        const retry = this.retryMap.get(fileId);
        if (retry && retry.timer) {
          clearTimeout(retry.timer);
        }
        this.retryMap.delete(fileId);

        // Update stats
        const stats = this.statsSubject.value;
        stats.totalSynced++;
        this.statsSubject.next(stats);

        console.debug(`[SyncManager] Synced ${fileId}`);
      } else {
        // Push failed - schedule retry
        this.scheduleRetry(file, adapter.name);
      }
    } catch (error) {
      console.error(`[SyncManager] Error pushing ${fileId}:`, error);
      this.scheduleRetry(file, 'unknown');

      const stats = this.statsSubject.value;
      stats.totalFailed++;
      this.statsSubject.next(stats);
    }
  }

  /**
   * Schedule a retry with exponential backoff.
   */
  private scheduleRetry(file: FileNode, adapterName: string): void {
    const fileId = file.id;

    let retry = this.retryMap.get(fileId);
    if (!retry) {
      retry = { attempts: 0, timer: null };
      this.retryMap.set(fileId, retry);
    }

    retry.attempts++;

    if (retry.attempts >= this.maxRetries) {
      console.warn(
        `[SyncManager] Max retries (${this.maxRetries}) exceeded for ${fileId}`
      );
      this.retryMap.delete(fileId);
      return;
    }

    const delayMs = this.retryDelays[retry.attempts - 1] || this.retryDelays[this.retryDelays.length - 1];
    console.info(
      `[SyncManager] Retrying ${fileId} in ${delayMs}ms (attempt ${retry.attempts}/${this.maxRetries})`
    );

    if (retry.timer) {
      clearTimeout(retry.timer);
    }

    retry.timer = setTimeout(async () => {
      try {
        const latestFile = await getCachedFile(fileId, file.workspaceId);
        if (latestFile && latestFile.dirty) {
          console.log(`[SyncManager] Executing scheduled retry for ${fileId}`);
          await this.pushDirtyFile(latestFile as FileNode);
        }
      } catch (err) {
        console.error(`[SyncManager] Retry failed for ${fileId}:`, err);
      }
    }, delayMs);
  }

  /**
   * Trigger sync for all dirty files in current workspace.
   */
  async syncNow(): Promise<void> {
    if (!this.activeWorkspaceId) {
      console.warn('[SyncManager] No active workspace, syncNow is no-op');
      return;
    }

    console.log(`[SyncManager] syncNow for workspace: ${this.activeWorkspaceId}`);
    this.statusSubject.next(SyncStatus.SYNCING);

    try {
      const dirtyFiles = await queryDirtyFiles(this.activeWorkspaceId);
      console.log(`[SyncManager] Found ${dirtyFiles.length} dirty files`);

      for (const file of dirtyFiles) {
        if (file.dirty) {
          await this.pushDirtyFile(file as FileNode);
        }
      }

      this.statusSubject.next(SyncStatus.IDLE);
      console.log('[SyncManager] ✓ syncNow complete');
    } catch (err) {
      console.error('[SyncManager] syncNow failed:', err);
      this.statusSubject.next(SyncStatus.ERROR);
    }
  }

  // ============================================================================
  // WORKSPACE PULL & OPERATIONS
  // ============================================================================

  /**
   * Pull entire workspace from adapter (during workspace switch).
   * For Local workspaces, ensures all files are fetched and upserted to RxDB.
   * Handles adapter readiness and logs detailed information.
   */
  async pullWorkspace(workspace: { id: string; type: WorkspaceType | string }): Promise<void> {
    console.log(`[SyncManager] Pulling workspace: ${workspace.id} (type: ${workspace.type})`);

    try {
      const workspaceType = String(workspace.type);
      const adapter = this.adaptersByWorkspace.get(workspace.id);

      if (!adapter) {
        console.warn(`[SyncManager] No adapter for workspace ${workspace.id}`);
        return;
      }

      // Check adapter readiness
      if (!adapter.validateReady()) {
        const readinessInfo = adapter.getReadinessInfo();
        console.info(
          `[SyncManager] Adapter not ready for workspace ${workspace.id} (state: ${readinessInfo.state}). ` +
          `For Local workspaces, user must grant directory access first.`
        );
        return;
      }

      if (typeof (adapter as any).pullWorkspace === 'function') {
        console.log(`[SyncManager] Fetching all files from adapter for workspace ${workspace.id}...`);
        const entries = await (adapter as any).pullWorkspace(workspace.id);

        console.log(`[SyncManager] Received ${entries.length} file entries from adapter`);

        const fileNodes = fileNodeBridge.adapterResponseToFileNode(
          entries,
          adapter.name as any,
          workspace.id
        );

        // Upsert all files into RxDB
        for (const fileNode of fileNodes) {
          try {
            await saveFileNode(fileNode);
            console.debug(`[SyncManager] Upserted file to RxDB: ${fileNode.id} (path: ${fileNode.path})`);
          } catch (e) {
            console.warn(`[SyncManager] Failed to save FileNode ${fileNode.id}`, e);
          }
        }

        console.info(
          `[SyncManager] ✓ Pulled and upserted ${fileNodes.length} files from ${adapter.name} for workspace ${workspace.id}`
        );
      }
    } catch (e) {
      console.error(`[SyncManager] pullWorkspace failed:`, e);
    }
  }

  /**
   * Facade: request user to open a local directory.
   * Delegates to local adapter.
   * 
   * If workspace adapter hasn't been initialized yet, initializes it first.
   */
  async requestOpenLocalDirectory(workspaceId?: string): Promise<void> {
    // Ensure workspace adapter is initialized before trying to use it
    if (workspaceId) {
      try {
        await this.initializeForWorkspace(workspaceId);
      } catch (e) {
        console.warn(`[SyncManager] Failed to initialize workspace ${workspaceId} before opening directory:`, e);
        // Continue anyway - adapter might be available from registry or global map
      }
    }

    const adapter = this.adaptersByWorkspace.get(workspaceId || '') ||
      this.adapters.get('local');
    if (!adapter) throw new Error(`Local adapter not registered or initialized for workspace: ${workspaceId}`);

    const impl: any = adapter as any;
    if (typeof impl.openDirectoryPicker === 'function') {
      await impl.openDirectoryPicker(workspaceId);
      if (workspaceId) {
        try {
          await this.pullWorkspace({ id: workspaceId, type: WorkspaceType.Local });
        } catch (e) {
          console.warn('pullWorkspace after openLocalDirectory failed:', e);
        }
        // Trigger sync of any dirty files after adapter is ready
        try {
          console.log(`[SyncManager] Syncing dirty files for workspace ${workspaceId} after directory picker...`);
          await this.syncNow();
        } catch (e) {
          console.warn('syncNow after openLocalDirectory failed:', e);
        }
      }
      return;
    }
    throw new Error('Local adapter does not support directory picker');
  }

  /**
   * Facade: request permission and restore local directory handle.
   */
  async requestPermissionForLocalWorkspace(workspaceId: string): Promise<boolean> {
    const adapter = this.adaptersByWorkspace.get(workspaceId) ||
      this.adapters.get('local');
    if (!adapter) return false;

    const impl: any = adapter as any;
    if (typeof impl.promptPermissionAndRestore === 'function') {
      const res = await impl.promptPermissionAndRestore(workspaceId);
      if (res && workspaceId) {
        try {
          await this.pullWorkspace({ id: workspaceId, type: WorkspaceType.Local });
        } catch (e) {
          console.warn('pullWorkspace after permission restore failed:', e);
        }
        // Trigger sync of any dirty files after adapter is ready
        try {
          console.log(`[SyncManager] Syncing dirty files for workspace ${workspaceId} after permission restore...`);
          await this.syncNow();
        } catch (e) {
          console.warn('syncNow after permission restore failed:', e);
        }
      }
      return !!res;
    }
    return false;
  }

  /**
   * Pull a single file from adapter to cache.
   */
  async pullFileToCache(fileId: string, workspaceType: WorkspaceType | string, workspaceId?: string): Promise<void> {
    try {
      const adapterName = String(workspaceType) === 'drive' ? 'gdrive' : String(workspaceType);
      const adapter = this.adaptersByWorkspace.get(workspaceId || '') ||
        this.adapters.get(adapterName);

      if (!adapter || typeof (adapter as any).pull !== 'function') {
        throw new Error(`Adapter not available for ${adapterName}`);
      }

      const content = await (adapter as any).pull(fileId);
      if (typeof content === 'string') {
        const normalized = adapterEntryToCachedFile({ fileId }, workspaceType as any, workspaceId);
        await upsertCachedFile({ ...normalized, dirty: false });
        await saveFile(normalized.path || fileId, content, workspaceType as any, undefined, workspaceId);
      }
    } catch (err) {
      console.warn('pullFileToCache failed:', err);
      throw err;
    }
  }

  /**
   * Enqueue a file for direct processing.
   */
  async enqueueAndProcess(fileId: string, path: string, workspaceType: string, workspaceId?: string): Promise<void> {
    try {
      const cached = await getCachedFile(fileId, workspaceId);
      if (cached) {
        await this.pushDirtyFile(cached as FileNode);
      }
    } catch (err) {
      console.error('enqueueAndProcess error for', fileId, err);
    }
  }

  /**
   * Check if a Local workspace adapter needs directory handle/permission.
   * Returns readiness info and indicates what action is needed.
   * 
   * Used by UI to determine whether to show "Grant Permission" or "Pick Directory" prompt.
   */
  getLocalAdapterReadinessForWorkspace(workspaceId: string): {
    isReady: boolean;
    state: AdapterState | string;
    needsUserGesture: boolean;
    error?: AdapterInitError | null;
  } {
    const adapter = this.adaptersByWorkspace.get(workspaceId);
    if (!adapter) {
      return {
        isReady: false,
        state: 'not-initialized',
        needsUserGesture: true,
      };
    }

    const readinessInfo = adapter.getReadinessInfo();
    const needsUserGesture =
      readinessInfo.state === AdapterState.INITIALIZING ||
      readinessInfo.state === AdapterState.UNINITIALIZED;

    return {
      isReady: readinessInfo.isReady,
      state: readinessInfo.state,
      needsUserGesture,
      error: readinessInfo.error,
    };
  }

  // ============================================================================
  // OBSERVABLES
  // ============================================================================

  getStatusObservable(): Observable<SyncStatus> {
    return this.statusSubject.asObservable().pipe(
      distinctUntilChanged(),
      throttleTime(500, undefined, { leading: true, trailing: true })
    );
  }

  /**
   * Backward compat: old API used status$()
   * @deprecated Use getStatusObservable() instead
   */
  status$(): Observable<SyncStatus> {
    return this.getStatusObservable();
  }

  getStatsObservable(): Observable<SyncStats> {
    return this.statsSubject.asObservable().pipe(
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    );
  }

  // ============================================================================
  // ADAPTER EVENT HANDLING
  // ============================================================================

  /**
   * Subscribe to lifecycle events from an adapter.
   * Handles state transitions, ready events, and errors.
   */
  private subscribeToAdapterEvents(adapter: ISyncAdapter, workspaceId: string): void {
    const listener = (event: AdapterLifecycleEvent) => {
      console.log(
        `[SyncManager] Adapter event (${workspaceId}):`,
        event.type,
        event
      );

      if (event.type === 'state-changed') {
        const { state } = event;

        if (state === AdapterState.READY) {
          console.log(`[SyncManager] 🟢 Adapter ready for ${workspaceId}, processing queue...`);
          this.processQueueForWorkspace(workspaceId).catch((e) => {
            console.error(`[SyncManager] Error processing queue:`, e);
          });
        } else if (state === AdapterState.ERRORED) {
          console.error(
            `[SyncManager] 🔴 Adapter error for ${workspaceId}:`,
            adapter.getError()
          );
        }
      } else if (event.type === 'initialization-failed') {
        console.error(
          `[SyncManager] Initialization failed for ${workspaceId}:`,
          event.error
        );
      }
    };

    adapter.addEventListener(listener);
    this.storeEventListener(adapter.name, listener);
  }

  /**
   * Store event listener for cleanup.
   */
  private storeEventListener(adapterName: string, listener: (event: AdapterLifecycleEvent) => void): void {
    if (!this.adapterEventListeners.has(adapterName)) {
      this.adapterEventListeners.set(adapterName, new Set());
    }
    this.adapterEventListeners.get(adapterName)!.add(listener);
  }

  /**
   * Process queued files for a workspace now that adapter is ready.
   */
  private async processQueueForWorkspace(workspaceId: string): Promise<void> {
    const queued = this.fileQueue.getByWorkspace(workspaceId);
    console.log(`[SyncManager] Processing ${queued.length} queued files for workspace ${workspaceId}`);

    for (const entry of queued) {
      try {
        const file = await getCachedFile(entry.fileId, workspaceId);
        if (file && file.dirty) {
          console.log(`[SyncManager] Retrying queued file: ${entry.fileId}`);
          await this.pushDirtyFile(file as FileNode);
        }
      } catch (e) {
        console.error(`[SyncManager] Failed to process queued file ${entry.fileId}:`, e);
      }
    }
  }

  /**
   * Emit a global event (for UI listeners).
   */
  private emitGlobalEvent(event: AdapterLifecycleEvent): void {
    console.log('[SyncManager] Global event:', event);
    // TODO: Emit to global event emitter if needed for UI notifications
  }

  /**
   * Get readiness info for a workspace.
   */
  getAdapterReadinessInfo(workspaceId: string): AdapterReadinessInfo | null {
    const adapter = this.adaptersByWorkspace.get(workspaceId);
    if (!adapter) return null;
    return adapter.getReadinessInfo();
  }
}

// ============================================================================
// SINGLETON GETTER & INITIALIZATION FUNCTION
// ============================================================================

/**
 * Get the global SyncManager singleton.
 */
export function getSyncManager(): SyncManager {
  return SyncManager.getInstance();
}

/**
 * Initialize and start the SyncManager.
 * Register adapters via AdapterRegistry first (see initializeAdapters below).
 */
export async function initializeSyncManager(): Promise<SyncManager> {
  const manager = SyncManager.getInstance();

  // Initialize for current active workspace
  const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
  if (activeWs) {
    console.log(`[SyncManager] Initializing adapter for active workspace: ${activeWs.id}`);
    await manager.initializeForWorkspace(activeWs.id);
  }

  manager.start();
  return manager;
}

/**
 * Stop and cleanup the SyncManager.
 */
export async function stopSyncManager(): Promise<void> {
  const manager = SyncManager.getInstance();
  await manager.stop();
}

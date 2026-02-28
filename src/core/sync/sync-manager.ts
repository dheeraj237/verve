import { BehaviorSubject, Observable, interval } from 'rxjs';
import { throttleTime, distinctUntilChanged } from 'rxjs/operators';
// Yjs disabled: CRDT merging turned off for now
import {
  getCacheDB,
  getCachedFile,
  getDirtyCachedFiles,
  markCachedFileAsSynced,
  observeCachedFiles,
  upsertCachedFile,
  loadFile,
  saveFile,
} from '../cache';
import type { ISyncAdapter as AdapterISyncAdapter } from './adapter-types';
import { MergeStrategy, NoOpMergeStrategy } from './merge-strategies';
import { enqueueSyncEntry, processPendingQueueOnce } from './sync-queue-processor';
import { defaultRetryPolicy } from './retry-policy';
import { v4 as uuidv4 } from 'uuid';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { CachedFile, FileType, SyncOp, WorkspaceType } from '@/core/cache/types';

// CRDT/Yjs handling removed from SyncManager. SyncManager now operates
// on plain file content strings. Adapters should accept/return string
// content. CRDT merging can be reintroduced later as a cache-layer
// responsibility and via adapter contracts.

/**
 * Sync adapter interface for pushing/pulling changes from remote sources
 * Adapters are only used for non-browser workspaces (local, gdrive, s3, etc.)
 * Browser workspaces have no sync adapter (purely local IndexedDB)
 * 
 * Implementations: LocalAdapter, GDriveAdapter, (future) S3Adapter
 */
export type ISyncAdapter = AdapterISyncAdapter;

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
 * and applies remote content into the cache (CRDT merging disabled)
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
  private mergeStrategy: MergeStrategy = new NoOpMergeStrategy();
  private remoteWatcherSubs: Map<string, any> = new Map();
  private isRunning = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private maxRetries = 3;
  private retryDelays = [1000, 3000, 5000]; // exponential backoff
  private usePersistentQueue = false;
  private cachedFilesSub: any = null;
  private pullInterval: ReturnType<typeof setInterval> | null = null;
  private periodicPullIntervalMs = 60000; // 1 minute
  private queueProcessInterval: ReturnType<typeof setInterval> | null = null;
  // Temporary safety switch: when false, skip pulling remote content after a successful push.
  // This hard-coded flag addresses the immediate issue where any file update triggered pulls
  // across all adapters/workspaces. Set to `true` to re-enable pull-after-push behavior.
  private pullAfterPush = false;

  constructor(private batchSize = 5) {}

  /**
   * Enable persistent queue processing. When enabled, dirty files are enqueued
   * into the durable `sync_queue` and processed by the queue processor.
   */
  enablePersistentQueue(processIntervalMs: number = 5000) {
    this.usePersistentQueue = true;
    // Start periodic queue processing
    if (!this.queueProcessInterval) {
      this.queueProcessInterval = setInterval(() => {
        try {
          processPendingQueueOnce(this.adapters).catch((err) => console.error('Queue processing failed:', err));
        } catch (err) {
          console.error('Queue processing scheduling failed:', err);
        }
      }, processIntervalMs);
    }
  }

  disablePersistentQueue() {
    this.usePersistentQueue = false;
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
      this.queueProcessInterval = null;
    }
  }

  /**
   * Enqueue a saved file for durable processing (when persistent queue enabled)
   * or attempt an immediate sync for the single file when queue is disabled.
   * This is intended to be called for saves originating from the active workspace
   * so that authorship is authoritative and pushes happen with minimal latency.
   */
  public async enqueueAndProcess(fileId: string, path: string, workspaceType: string, workspaceId?: string): Promise<void> {
    try {
      if (this.usePersistentQueue) {
        try {
          await enqueueSyncEntry({ op: SyncOp.Put, target: 'file', targetId: fileId, payload: { path, workspaceType, workspaceId } });
        } catch (e) {
          console.error('Failed to enqueue sync entry for saved file:', fileId, e);
        }

        try {
          await processPendingQueueOnce(this.adapters);
        } catch (e) {
          console.error('Failed to process sync queue immediately after enqueue:', e);
        }
      } else {
        // Attempt immediate one-off sync for this specific file
        try {
          const cached = await getCachedFile(fileId, workspaceId);
          if (cached) {
            // call private syncFile to perform push/pull for this file
            await this.syncFile(cached as CachedFile);
          }
        } catch (e) {
          console.warn('Immediate sync for saved file failed:', e);
        }
      }
    } catch (err) {
      console.error('enqueueAndProcess error for', fileId, err);
    }
  }

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

    // Background polling and remote watchers are disabled by default.
    // Enable via `enablePeriodicPull` or `enableRemoteWatching` when desired.

    // Subscribe to RxDB cached_files changes so we can react to edits immediately.
    try {
      this.cachedFilesSub = observeCachedFiles((files) => {
        for (const f of files) {
          try {
            if (f.dirty && String(f.workspaceType) !== WorkspaceType.Browser) {
              // Fire-and-forget an async sync for this specific file
              this.syncFile(f as CachedFile).catch((err) => {
                console.warn('Realtime sync failed for', f.id, err);
              });
            }
          } catch (err) {
            console.warn('Error processing cached file change:', err);
          }
        }
      });
    } catch (err) {
      console.warn('Failed to subscribe to cached file changes:', err);
    }

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
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
      this.queueProcessInterval = null;
    }
    if (this.pullInterval) {
      clearInterval(this.pullInterval);
      this.pullInterval = null;
    }
    // Unsubscribe from observed cached file changes
    try {
      if (this.cachedFilesSub && typeof this.cachedFilesSub.unsubscribe === 'function') {
        this.cachedFilesSub.unsubscribe();
      } else if (this.cachedFilesSub && typeof this.cachedFilesSub === 'function') {
        // observeCachedFiles may return an unsubscribe function
        this.cachedFilesSub();
      }
    } catch (err) {
      console.warn('Error unsubscribing cachedFilesSub:', err);
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
      const filesToSync = dirtyFiles.filter((file) => String(file.workspaceType) !== WorkspaceType.Browser);

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
    const { id: fileId } = file;

    try {
      // Load the latest content from cache (RxDB) as a plain string
      const fileData = await loadFile(file.path, file.workspaceType as any, file.workspaceId);
      const content = fileData?.content ?? '';

      // If persistent queue is enabled, enqueue durable work and return
      if (this.usePersistentQueue) {
        try {
          await enqueueSyncEntry({ op: SyncOp.Put, target: 'file', targetId: fileId, payload: { path: file.path, workspaceType: file.workspaceType, workspaceId: file.workspaceId } });
        } catch (e) {
          console.error('Failed to enqueue sync entry for', fileId, e);
        }
        return;
      }

      // Try to push to the adapter matching the file's workspace type only.
      // Adapter naming convention: WorkspaceType.Drive -> 'gdrive', otherwise string(workspaceType)
      let pushed = false;
      try {
        const adapterName = (file.workspaceType === WorkspaceType.Drive || String(file.workspaceType) === 'drive') ? 'gdrive' : String(file.workspaceType);
        const targetAdapter = this.adapters.get(adapterName);
        if (targetAdapter) {
          pushed = await this.pushWithRetry(targetAdapter, file, content);
        } else {
          console.warn(`No adapter registered for file workspace type: ${file.workspaceType}`);
        }
      } catch (err) {
        console.warn('Error while attempting push to matching adapter:', err);
      }

      if (pushed) {
        // Mark as synced
        await markCachedFileAsSynced(fileId);

        const stats = this.statsSubject.value;
        stats.totalSynced++;
        this.statsSubject.next(stats);
      }

      // Try to pull from each adapter (overwrite local content for now)
      // Controlled by `pullAfterPush` flag: when false, skip pulls to avoid
      // indiscriminately pulling workspaces/adapters on every file update.
      if (this.pullAfterPush) {
        try {
          const activeWorkspace = useWorkspaceStore.getState().activeWorkspace?.();
          // Only pull if the file belongs to the active workspace
          if (activeWorkspace && String(activeWorkspace.id) === String(file.workspaceId)) {
            const adapterName = (activeWorkspace.type === WorkspaceType.Drive || String(activeWorkspace.type) === 'drive') ? 'gdrive' : String(activeWorkspace.type);
            const targetAdapter = this.adapters.get(adapterName);
            if (targetAdapter && typeof targetAdapter.pull === 'function') {
              try {
                const remoteContent = await targetAdapter.pull(fileId);
                if (remoteContent) {
                  await this.mergeStrategy.handlePull(file, remoteContent);
                }
              } catch (error) {
                console.warn(`Failed to pull from ${targetAdapter.name}:`, error);
              }
            }
          }
        } catch (err) {
          console.warn('Error during conditional pull-after-push:', err);
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
    content: string
  ): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const success = await adapter.push(file, content as any);
        if (success) return true;
      } catch (error) {
        console.warn(`Push attempt ${attempt + 1} failed:`, error);

        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelays[attempt] || defaultRetryPolicy.getDelay(attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    return false;
  }

  /**
   * Merge remote content with local cache (CRDT merging currently disabled)
   * This method is a no-op; future CRDT behavior should be implemented in the cache layer.
   */
  private async mergeRemoteChanges(docId: string, remoteContent: string): Promise<void> {
    return Promise.resolve();
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
   * Public API to pull an entire workspace's remote state and upsert into RxDB.
   * This is used during blocking workspace switches to ensure RxDB contains
   * the latest remote files before the UI renders the workspace.
   */
  async pullWorkspace(workspace: { id: string; type: WorkspaceType | string; path?: string }): Promise<void> {
    if (!workspace) return;
    const adapterName = (workspace.type === WorkspaceType.Drive || workspace.type === 'drive') ? 'gdrive' : String(workspace.type);
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      console.warn(`No adapter registered for workspace type: ${workspace.type}`);
      return;
    }

    this.statusSubject.next(SyncStatus.SYNCING);

    try {
      // If adapter provides an optimized workspace pull, use it


      if (typeof adapter.pullWorkspace === 'function') {
        const items = await adapter.pullWorkspace(workspace.id, workspace.path);
        for (const item of items || []) {
          try {
            // Adapter should return content string in `content`.
            const content = (item as any).content ?? '';

            // Upsert cached file metadata and overwrite content (pull-on-switch semantics)
            await upsertCachedFile({ id: item.fileId, name: item.fileId.split('/').pop() || item.fileId, path: item.fileId, type: FileType.File, workspaceType: workspace.type as any, workspaceId: workspace.id, lastModified: Date.now(), dirty: false });
            await saveFile(item.fileId, content, workspace.type as any, undefined, workspace.id);
          } catch (err) {
            console.warn('Failed to upsert remote item during pullWorkspace:', err);
          }
        }
      } else if (typeof adapter.listWorkspaceFiles === 'function') {
        // Fall back to listing files and pulling each individually
        const list = await adapter.listWorkspaceFiles(workspace.id, workspace.path);
        for (const entry of list || []) {
          try {
            const remoteContent = await adapter.pull(entry.id);
            if (remoteContent) {
              await upsertCachedFile({ id: entry.id, name: entry.path.split('/').pop() || entry.id, path: entry.path, type: FileType.File, workspaceType: workspace.type as any, workspaceId: workspace.id, lastModified: Date.now(), dirty: false });
              await saveFile(entry.path, remoteContent, workspace.type as any, undefined, workspace.id);
            }
          } catch (err) {
            console.warn('Failed to pull remote file during pullWorkspace:', err);
          }
        }
      } else {
        // Adapter does not support workspace pulls; nothing to pull
        console.info(`Adapter ${adapter.name} does not support workspace pulls`);
      }

      this.statusSubject.next(SyncStatus.ONLINE);
    } catch (error) {
      console.error('pullWorkspace error:', error);
      this.statusSubject.next(SyncStatus.ERROR);
      throw error;
    }
  }

  /**
   * Periodic pull scaffolding for future background pulls. Not enabled by default.
   */
  startPeriodicPulls(intervalMs?: number): void {
    const ms = intervalMs ?? this.periodicPullIntervalMs;
    if (this.pullInterval) return;
    this.pullInterval = setInterval(() => {
      this.performPull().catch((err) => console.error('Periodic pull failed:', err));
    }, ms);
  }

  stopPeriodicPulls(): void {
    if (this.pullInterval) {
      clearInterval(this.pullInterval);
      this.pullInterval = null;
    }
  }

  /**
   * Public helper to enable periodic pulls (opt-in).
   */
  enablePeriodicPull(ms?: number): void {
    this.startPeriodicPulls(ms);
  }

  private async performPull(): Promise<void> {
    // Placeholder: iterate through configured workspaces and call pullWorkspace
    // Future enhancement: discover active workspaces and only pull those
    try {
      const workspace = useWorkspaceStore.getState().activeWorkspace?.();
      if (workspace) {
        await this.pullWorkspace(workspace);
      }
    } catch (err) {
      console.warn('performPull error:', err);
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
      if (!file) return;

      const remoteContent = await adapter.pull(fileId);
      if (typeof remoteContent === 'string' && remoteContent.length > 0) {
        // Delegate to merge strategy instead of blind overwrite
        await this.mergeStrategy.handlePull(file, remoteContent);
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
export async function initializeSyncManager(adapters: ISyncAdapter[], options?: { usePersistentQueue?: boolean; queueProcessIntervalMs?: number }): Promise<SyncManager> {
  const manager = getSyncManager();
  for (const adapter of adapters) {
    manager.registerAdapter(adapter);
  }
  if (options?.usePersistentQueue) {
    manager.enablePersistentQueue(options.queueProcessIntervalMs);
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

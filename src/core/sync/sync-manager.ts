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
  // NEW FileNode API
  queryDirtyFiles,
  getFileNodeWithContent,
  saveFileNode,
  updateSyncStatus,
} from '../cache';
import type { ISyncAdapter as AdapterISyncAdapter } from './adapter-types';
import { MergeStrategy, NoOpMergeStrategy } from './merge-strategies';
import { enqueueSyncEntry, processPendingQueueOnce } from './sync-queue-processor';
import { defaultRetryPolicy } from './retry-policy';
import { v4 as uuidv4 } from 'uuid';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { FileType, SyncOp, WorkspaceType } from '@/core/cache/types';
import type { FileNode } from '@/shared/types';
import { toAdapterDescriptor } from './adapter-types';
import { pushCachedFile } from './adapter-bridge';
// NEW: FileNode Bridge for type conversions
import { fileNodeBridge } from './file-node-bridge';
import { adapterEntryToCachedFile } from './adapter-normalize';

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
  private workspaceSub: any = null;
  private activeWorkspaceId: string | null = null;
  private syncQueueSub: any = null;
  private pullInterval: ReturnType<typeof setInterval> | null = null;
  private periodicPullIntervalMs = 60000; // 1 minute
  private queueProcessInterval: ReturnType<typeof setInterval> | null = null;
  // Temporary safety switch: when false, skip pulling remote content after a successful push.
  // This hard-coded flag addresses the immediate issue where any file update triggered pulls
  // across all adapters/workspaces. Set to `true` to re-enable pull-after-push behavior.
  private pullAfterPush = false;

  constructor(private batchSize = 5) {}

  /**
   * Facade: request user to open a local directory (must be called from a user gesture).
   * Delegates to the registered `local` adapter if it supports `openDirectoryPicker`.
   */
  async requestOpenLocalDirectory(workspaceId?: string): Promise<void> {
    const adapter = this.adapters.get('local');
    if (!adapter) throw new Error('Local adapter not registered');
    const impl: any = adapter as any;
    if (typeof impl.openDirectoryPicker === 'function') {
      await impl.openDirectoryPicker(workspaceId);
      // If a workspace id was provided, attempt to populate cache from the adapter
      if (workspaceId) {
        try {
          await this.pullWorkspace({ id: workspaceId, type: WorkspaceType.Local });
        } catch (e) {
          // Non-fatal - UI should continue even if full pull fails
          console.warn('pullWorkspace after openLocalDirectory failed:', e);
        }
      }
      return;
    }
    throw new Error('Local adapter does not support directory picker');
  }

  /**
   * Facade: prompt for permission and restore a stored local directory handle.
   * Delegates to the local adapter if available.
   */
  async requestPermissionForLocalWorkspace(workspaceId: string): Promise<boolean> {
    const adapter = this.adapters.get('local');
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
      }
      return !!res;
    }
    return false;
  }

  /**
   * Facade: pull a single file from the adapter into RxDB cache.
   * Adapter must implement `pull(fileId)` which returns string content.
   */
  async pullFileToCache(fileId: string, workspaceType: WorkspaceType | string, workspaceId?: string): Promise<void> {
    try {
      const adapterName = (String(workspaceType) === 'drive' || workspaceType === WorkspaceType.GDrive) ? 'gdrive' : String(workspaceType);
      const adapter = this.adapters.get(adapterName);
      if (!adapter || typeof (adapter as any).pull !== 'function') {
        throw new Error(`Adapter not available for ${adapterName}`);
      }
      const content = await (adapter as any).pull(fileId);
      if (typeof content === 'string') {
        // Normalize into cached file and upsert
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
            await this.syncFile(cached as FileNode);
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

    // Subscribe to active workspace changes and listen to cached file updates
    try {
      this.workspaceSub = (useWorkspaceStore.subscribe as any)(
        (s) => s.activeWorkspaceId,
        (newId: string | null, oldId: string | null) => {
          try {
            // Teardown previous cachedFiles subscription
            if (this.cachedFilesSub) {
              try {
                if (typeof this.cachedFilesSub.unsubscribe === 'function') this.cachedFilesSub.unsubscribe();
                else if (typeof this.cachedFilesSub === 'function') this.cachedFilesSub();
              } catch (u) {
                // ignore
              }
              this.cachedFilesSub = null;
            }

            this.activeWorkspaceId = newId;

            // If there's no active workspace, don't subscribe to realtime pushes
            if (!newId) return;

      // Observe all cached files but filter for the active workspace in the handler
            this.cachedFilesSub = observeCachedFiles((files) => {
              for (const f of files) {
                try {
                  if (String(f.workspaceId) !== String(newId)) continue;
                  if (f.dirty && String(f.workspaceType) !== WorkspaceType.Browser) {
                    this.syncFile(f as FileNode).catch((err) => {
                      console.warn('Realtime sync failed for', f.id, err);
                    });
                  }
                } catch (err) {
                  console.warn('Error processing cached file change for active workspace:', err);
                }
              }
            });
          } catch (err) {
            console.warn('Failed to subscribe to cached file changes for active workspace:', err);
          }
        }
      );
    } catch (err) {
      console.warn('Failed to subscribe to workspace store changes:', err);
    }

    // Setup queue subscription for immediate processing of certain entries
    try {
      this.setupQueueSubscription();
    } catch (err) {
      // non-fatal
    }

    console.log('SyncManager started');
  }

  /**
   * Subscribe to `sync_queue` and attempt best-effort immediate processing
   * for UX-sensitive operations (local deletes and puts targeting the active workspace).
   */
  private setupQueueSubscription(): void {
    try {
      const db = getCacheDB();
      if (!db || !db.sync_queue || typeof db.sync_queue.find !== 'function') return;

      const query = db.sync_queue.find().sort({ createdAt: 'asc' });
      if (!query || !query.$ || typeof query.$.subscribe !== 'function') return;

      this.syncQueueSub = query.$.subscribe((docs: any[]) => {
        try {
          for (const doc of docs || []) {
            const entry = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
            try {
              // Immediate-delete optimization for local workspaces
              if (entry.op === SyncOp.Delete && entry.payload && String(entry.payload.workspaceType) === WorkspaceType.Local) {
                const localAdapter = this.adapters.get('local');
                if (localAdapter) {
                  console.info('[SyncManager] Immediate local delete detected, processing now');
                  processPendingQueueOnce(new Map([[localAdapter.name, localAdapter]])).catch((e) => {
                    console.warn('Immediate local delete processing failed:', e);
                  });
                  break;
                }
              }

              // Immediate-Put optimization for active workspace (only if adapter ready)
              if (entry.op === SyncOp.Put && entry.payload && entry.payload.workspaceId) {
                try {
                  const active = useWorkspaceStore.getState().activeWorkspace?.();
                  if (active && String(active.id) === String(entry.payload.workspaceId)) {
                    const adapterName = (String(entry.payload.workspaceType) === 'drive' || entry.payload.workspaceType === WorkspaceType.GDrive) ? 'gdrive' : String(entry.payload.workspaceType);
                    const targetAdapter = this.adapters.get(adapterName);
                    if (targetAdapter) {
                      try {
                        const ready = typeof (targetAdapter as any).isReady === 'function' ? (targetAdapter as any).isReady() : true;
                        if (ready) {
                          console.info('[SyncManager] Immediate Put detected for active workspace, processing now via adapter:', adapterName);
                          processPendingQueueOnce(new Map([[targetAdapter.name, targetAdapter]])).catch((e) => {
                            console.warn('Immediate put processing failed:', e);
                          });
                          break;
                        } else {
                          console.info('[SyncManager] Adapter not ready for immediate Put:', adapterName);
                        }
                      } catch (chk) {
                        console.warn('Failed to check adapter readiness:', chk);
                      }
                    }
                  }
                } catch (innerPut) {
                  // ignore per-entry Put errors
                }
              }
            } catch (inner) {
              // ignore per-entry errors
            }
          }
        } catch (e) {
          // ignore subscription handler errors
        }
      });
    } catch (e) {
      // non-fatal
    }
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
      // Unsubscribe from workspace store subscription
      if (this.workspaceSub && typeof this.workspaceSub === 'function') {
        try {
          this.workspaceSub();
        } catch (e) {
          // ignore
        }
      } else if (this.workspaceSub && typeof this.workspaceSub.unsubscribe === 'function') {
        try {
          this.workspaceSub.unsubscribe();
        } catch (e) {
          // ignore
        }
      }
      if (this.syncQueueSub && typeof this.syncQueueSub.unsubscribe === 'function') {
        this.syncQueueSub.unsubscribe();
      } else if (this.syncQueueSub && typeof this.syncQueueSub === 'function') {
        this.syncQueueSub();
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
  private async syncFile(file: FileNode): Promise<void> {
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
        const adapterName = (String(file.workspaceType) === 'drive' || file.workspaceType === WorkspaceType.GDrive) ? 'gdrive' : String(file.workspaceType);
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
            const adapterName = (String(activeWorkspace.type) === 'drive' || activeWorkspace.type === WorkspaceType.GDrive) ? 'gdrive' : String(activeWorkspace.type);
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
    file: FileNode,
    content: string
  ): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const success = await pushCachedFile(adapter, file as any, content as any);
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
    const adapterName = (String(workspace.type) === 'drive' || workspace.type === WorkspaceType.GDrive) ? 'gdrive' : String(workspace.type);
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
            const id = (item as any).fileId ?? (item as any).id ?? '';

            // Normalize minimal info into canonical cached file and upsert
            const normalized = adapterEntryToCachedFile({ fileId: id }, workspace.type as any, workspace.id);
            await upsertCachedFile({ ...normalized, dirty: false });
            await saveFile(normalized.path || id, content, workspace.type as any, undefined, workspace.id);
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
            const normalized = adapterEntryToCachedFile(entry as any, workspace.type as any, workspace.id);
            await upsertCachedFile({ ...normalized, dirty: false });
            if (typeof remoteContent === 'string' && remoteContent.length > 0) {
              await saveFile(normalized.path || entry.path || entry.id, remoteContent, workspace.type as any, undefined, workspace.id);
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
      // Non-fatal: adapter initialization or listing failures (e.g. local dir not provided)
      // should not throw and block workspace switching. Log a warning and continue.
      console.warn('pullWorkspace warning (non-fatal):', error);
      this.statusSubject.next(SyncStatus.OFFLINE);
      return;
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

  // ==================== NEW FileNode-Based Sync Methods ====================
  /**
   * Pull changes from adapter using FileNode API
   * Converts adapter entries to FileNode and persists to RxDB
   * @param adapter Sync adapter to pull from
   * @param workspaceId Target workspace ID
   */
  async pullFromAdapterWithFileNode(
    adapter: ISyncAdapter,
    workspaceId: string
  ): Promise<void> {
    try {
      // Get adapter entries (if listWorkspaceFiles exists)
      const adapterImpl = adapter as any;
      if (!adapterImpl.listWorkspaceFiles) {
        console.warn(`[SyncManager] Adapter ${adapter.name} does not support listWorkspaceFiles`);
        return;
      }

      const entries = await adapterImpl.listWorkspaceFiles(workspaceId);
      if (!entries || entries.length === 0) {
        console.info(`[SyncManager] No files to pull from ${adapter.name}`);
        return;
      }

      // Convert adapter entries to FileNode
      const fileNodes = fileNodeBridge.adapterResponseToFileNode(
        entries,
        adapter.name as any,
        workspaceId
      );

      // Persist to RxDB
      for (const fileNode of fileNodes) {
        try {
          await saveFileNode(fileNode);
        } catch (e) {
          console.warn(`[SyncManager] Failed to save FileNode ${fileNode.id}`, e);
        }
      }

      console.info(`[SyncManager] Pulled ${fileNodes.length} files from ${adapter.name} for workspace ${workspaceId}`);
    } catch (e) {
      console.error(`[SyncManager] pullFromAdapterWithFileNode failed:`, e);
    }
  }

  /**
   * Push dirty files to adapter using FileNode API
   * Converts dirty FileNodes to adapter descriptors and pushes
   * @param adapter S adapter to push to
   * @param workspaceId Target workspace ID
   */
  async pushToAdapterWithFileNode(
    adapter: ISyncAdapter,
    workspaceId: string
  ): Promise<void> {
    try {
      // Get all dirty files for this workspace
      const dirtyFiles = await queryDirtyFiles(workspaceId);
      if (dirtyFiles.length === 0) {
        console.info(`[SyncManager] No dirty files to push for workspace ${workspaceId}`);
        return;
      }

      // Load content for files if needed
      const filesWithContent = await Promise.all(
        dirtyFiles.map(async (file) => {
          if (file.type === FileType.File && !file.content) {
            return getFileNodeWithContent(file.id) || file;
          }
          return file;
        })
      );

      // Convert to adapter descriptors
      const descriptors = fileNodeBridge.fileNodeToAdapterDescriptor(
        filesWithContent,
        adapter.name as any
      );

      // Push to adapter
      const adapterImpl = adapter as any;
      if (adapterImpl.pushChanges && typeof adapterImpl.pushChanges === 'function') {
        await adapterImpl.pushChanges(descriptors);
      } else {
        console.warn(`[SyncManager] Adapter ${adapter.name} does not support pushChanges`);
        return;
      }

      // Mark files as synced
      for (const file of dirtyFiles) {
        try {
          await updateSyncStatus(file.id, 'idle', (file.version ?? 0) + 1);
        } catch (e) {
          console.warn(`[SyncManager] Failed to update sync status for ${file.id}`, e);
        }
      }

      console.info(`[SyncManager] Pushed ${dirtyFiles.length} files to ${adapter.name} for workspace ${workspaceId}`);
    } catch (e) {
      console.error(`[SyncManager] pushToAdapterWithFileNode failed:`, e);
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
  // Attempt to auto-initialize local adapter from persisted directory handle for the active workspace.
  try {
    const active = useWorkspaceStore.getState().activeWorkspace?.();
    if (active && active.type === WorkspaceType.Local) {
      const localAdapter = manager.getAdapter('local') as any;
      if (localAdapter && typeof localAdapter.initialize === 'function') {
        try {
          // Ensure RxDB is available for handle metadata helpers and attempt to restore
          // the persisted handle via `workspace-manager` which will also upsert RxDB metadata.
          const { initializeRxDB } = await import('@/core/cache/file-manager');
          const { restoreDirectoryHandle } = await import('@/core/cache/workspace-manager');
          try { await initializeRxDB(); } catch (e) { /* best-effort */ }
          const handle = await restoreDirectoryHandle(active.id);
          if (handle) {
            await localAdapter.initialize(handle);
          }
        } catch (e) {
          // Non-fatal: log and continue. UI/gesture based flows will prompt when needed.
          console.warn('Failed to auto-initialize local adapter from stored handle:', e);
        }
      }
    }
  } catch (e) {
    // ignore errors during best-effort adapter restore
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

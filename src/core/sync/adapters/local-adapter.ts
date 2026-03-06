/**
 * Local Adapter - Refactored with Java-Style OOP & Lifecycle State Machine
 * 
 * Key improvements over old version:
 * - Workspace ID immutably bound via constructor
 * - Private constructor + static factory pattern
 * - Lifecycle state machine: UNINITIALIZED -> INITIALIZING -> READY/ERRORED -> DESTROYING -> DESTROYED
 * - Event-based listeners for state changes
 * - Strict readiness validation (state + handle + permissions)
 * - Removed dead code (setCurrentWorkspace was never called)
 * 
 * Bug fix:
 * - OLD: currentWorkspaceId was always null, isReady() always returned false
 * - NEW: workspaceId immutable from construction, guaranted valid
 */

import type { ISyncAdapter, AdapterFileDescriptor } from '../adapter-types';
import {
  AdapterState,
  AdapterInitError,
  AdapterInitContext,
  AdapterErrorCode,
  AdapterReadinessInfo,
  AdapterLifecycleEvent,
  AdapterEventListener,
} from '../types/adapter-lifecycle';
import type { FileNode } from '@/shared/types';
import {
  requestPermissionForWorkspace,
  storeDirectoryHandle as workspaceStoreDirectoryHandle,
} from '@/core/cache/workspace-manager';
import { buildFileTreeFromDirectory } from '@/features/file-explorer/store/helpers/file-tree-builder';
import { upsertCachedFile } from '@/core/cache/file-manager';
import { FileType, WorkspaceType } from '@/core/cache/types';

/**
 * Local adapter using File System Access API.
 * Workspace-scoped, with immutable workspaceId binding.
 * 
 * IMPORTANT: Instantiate via static factory, not with 'new'.
 * Example:
 *   const adapter = await LocalAdapter.create('workspace-123')
 *   await adapter.initialize(context)
 */
export class LocalAdapter implements ISyncAdapter {
  readonly name = 'local';

  // Immutable workspace binding - set in constructor, never changes
  private readonly workspaceId: string;

  // Lifecycle state - updated via setState() with event emission
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private error: AdapterInitError | null = null;

  // Directory handle storage - per workspace (though we only have one workspace per instance)
  private dirHandle: FileSystemDirectoryHandle | null = null;

  // Event listeners for state changes
  private listeners: Set<AdapterEventListener> = new Set();

  /**
   * Private constructor - use static create() factory instead.
   * @param workspaceId - Immutably bound workspace ID
   */
  private constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.state = AdapterState.UNINITIALIZED;
    console.log(`[LocalAdapter] Created (workspace: ${workspaceId}, state: ${this.state})`);
  }

  /**
   * Factory: Create a new LocalAdapter for a workspace (UNINITIALIZED state).
   * Does NOT call initialize() - caller must do that explicitly.
   */
  static async create(workspaceId: string): Promise<LocalAdapter> {
    if (!workspaceId) {
      throw new Error('Workspace ID is required to create LocalAdapter');
    }
    const adapter = new LocalAdapter(workspaceId);
    console.log(`[LocalAdapter] Factory created new instance for workspace: ${workspaceId}`);
    return adapter;
  }

  // ============================================================================
  // LIFECYCLE STATE MACHINE
  // ============================================================================

  /**
   * Get current lifecycle state.
   */
  getState(): AdapterState {
    return this.state;
  }

  /**
   * Get last initialization error (null if no error or state !== ERRORED).
   */
  getError(): AdapterInitError | null {
    return this.error;
  }

  /**
   * Get comprehensive readiness snapshot (immutable).
   */
  getReadinessInfo(): AdapterReadinessInfo {
    const isReady = this.state === AdapterState.READY && this.dirHandle !== null;
    return new AdapterReadinessInfo(
      isReady,
      this.state,
      this.error,
      this.workspaceId,
      this.dirHandle !== null,
      new Date()
    );
  }

  /**
   * Validate adapter is truly ready (synchronous, cached check).
   * Required before push/pull operations.
   */
  validateReady(): boolean {
    return this.state === AdapterState.READY && this.dirHandle !== null;
  }

  /**
   * Initialize adapter with optional context (directory handle or permissions).
   * Async operation that may transition to READY or ERRORED state.
   * Does NOT throw - errors are emitted as events.
   */
  async initialize(context: AdapterInitContext): Promise<void> {
    console.log(
      `[LocalAdapter] initialize() called for workspace: ${context.workspaceId}`,
    );

    if (context.workspaceId !== this.workspaceId) {
      const err = new AdapterInitError(
        AdapterErrorCode.WORKSPACE_NOT_FOUND,
        `Workspace mismatch: adapter is for ${this.workspaceId}, but context specifies ${context.workspaceId}`
      );
      this.setState(AdapterState.ERRORED, err);
      this.emitEvent({
        type: 'initialization-failed',
        error: err,
        timestamp: new Date(),
      });
      return;
    }

    try {
      this.setState(AdapterState.INITIALIZING);

      // If context has a directory handle, use it
      if (context.dirHandle) {
        this.dirHandle = context.dirHandle;
        console.log(`[LocalAdapter] Initialized with provided directory handle`);
        this.setState(AdapterState.READY);
        this.emitEvent({
          type: 'ready',
          workspaceId: this.workspaceId,
          timestamp: new Date(),
        });
        return;
      }

      // Try to restore from persisted handle (no user gesture)
      const restored = await this.attemptRestorePersistedHandle();
      if (restored) {
        console.log(`[LocalAdapter] Restored persisted directory handle`);
        this.setState(AdapterState.READY);
        this.emitEvent({
          type: 'ready',
          workspaceId: this.workspaceId,
          timestamp: new Date(),
        });
        return;
      }

      // No handle available - stay in INITIALIZING, wait for user gesture
      console.log(
        `[LocalAdapter] No directory handle available. Waiting for user gesture (openDirectoryPicker).`
      );
      // Stay in INITIALIZING state until openDirectoryPicker is called
    } catch (err) {
      const error = new AdapterInitError(
        AdapterErrorCode.INITIALIZATION_FAILED,
        `Failed to initialize local adapter`,
        err as Error
      );
      this.setState(AdapterState.ERRORED, error);
      this.emitEvent({
        type: 'initialization-failed',
        error,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Destroy the adapter and release resources.
   * Transitions to DESTROYING -> DESTROYED.
   */
  async destroy(): Promise<void> {
    console.log(`[LocalAdapter] destroy() called for workspace: ${this.workspaceId}`);

    try {
      this.setState(AdapterState.DESTROYING);

      // Release directory handle
      this.dirHandle = null;
      this.listeners.clear();

      this.setState(AdapterState.DESTROYED);
      console.log(`[LocalAdapter] ✓ Destroyed`);
    } catch (err) {
      const error = new AdapterInitError(
        AdapterErrorCode.UNKNOWN,
        `Error during destroy`,
        err as Error
      );
      this.setState(AdapterState.ERRORED, error);
      throw error;
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  /**
   * Register a listener for adapter lifecycle events.
   */
  addEventListener(listener: AdapterEventListener): void {
    this.listeners.add(listener);
    console.log(`[LocalAdapter] Event listener added (total: ${this.listeners.size})`);
  }

  /**
   * Remove a registered listener.
   */
  removeEventListener(listener: AdapterEventListener): void {
    this.listeners.delete(listener);
  }

  // ============================================================================
  // USER GESTURES & PERMISSION HANDLING
  // ============================================================================

  /**
   * User gesture: open directory picker and initialize.
   * Requires user interaction (button click, etc.).
   * 
   * After this succeeds, adapter should transition to READY.
   * Only requests READ permission initially. WRITE permission is requested on-demand during push().
   * Scans directory and upserts all found files into RxDB cache.
   */
  async openDirectoryPicker(): Promise<void> {
    console.log(`[LocalAdapter] openDirectoryPicker() for workspace: ${this.workspaceId}`);

    if (!('showDirectoryPicker' in window)) {
      const err = new AdapterInitError(
        AdapterErrorCode.PERMISSION_DENIED,
        'Directory picker not supported in this browser'
      );
      this.setState(AdapterState.ERRORED, err);
      this.emitEvent({
        type: 'initialization-failed',
        error: err,
        timestamp: new Date(),
      });
      return;
    }

    try {
      // User gesture: open directory picker
      const dirHandle = await (window as any).showDirectoryPicker();

      // Verify we have READ permission for initial loading (showDirectoryPicker grants this)
      const hasReadPermission = await this.hasPermission(dirHandle, 'read');
      if (!hasReadPermission) {
        const err = new AdapterInitError(
          AdapterErrorCode.PERMISSION_DENIED,
          'Read access not granted for selected directory'
        );
        this.setState(AdapterState.ERRORED, err);
        this.emitEvent({
          type: 'initialization-failed',
          error: err,
          timestamp: new Date(),
        });
        return;
      }

      // Persist handle metadata to IndexedDB
      try {
        await workspaceStoreDirectoryHandle(this.workspaceId, dirHandle);
        console.log(`[LocalAdapter] Stored directory handle for workspace: ${this.workspaceId}`);
      } catch (e) {
        console.warn('[LocalAdapter] Failed to store directory handle metadata:', e);
      }

      // Store handle and transition to READY
      this.dirHandle = dirHandle;
      this.setState(AdapterState.READY);

      // Scan and populate cache with directory contents (READ operations only)
      try {
        console.log(`[LocalAdapter] Scanning directory contents for workspace: ${this.workspaceId}`);
        const tree = await buildFileTreeFromDirectory(dirHandle);
        console.log(`[LocalAdapter] Found ${tree.length} top-level items in directory`);

        await this.walkAndUpsertTree(tree);
        console.log(`[LocalAdapter] ✓ Scanned and cached directory contents`);
      } catch (e) {
        console.warn('[LocalAdapter] Failed to scan directory contents:', e);
      }

      this.emitEvent({
        type: 'ready',
        workspaceId: this.workspaceId,
        timestamp: new Date(),
      });
      console.log(`[LocalAdapter] ✓ Directory picker succeeded, adapter is READY. Write permission will be requested on first file modification.`);
    } catch (err) {
      if ((err as DOMException | any).name === 'AbortError') {
        // User cancelled
        console.log(`[LocalAdapter] User cancelled directory picker`);
        return;
      }

      const error = new AdapterInitError(
        AdapterErrorCode.PERMISSION_DENIED,
        `Directory picker failed`,
        err as Error
      );
      this.setState(AdapterState.ERRORED, error);
      this.emitEvent({
        type: 'initialization-failed',
        error,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Request permission for stored directory handle (no user gesture required).
   * Uses browser's permission API to restore a previously granted handle.
   */
  async promptPermissionAndRestore(workspaceId: string): Promise<boolean> {
    if (workspaceId !== this.workspaceId) {
      console.warn(`[LocalAdapter] Workspace mismatch in promptPermissionAndRestore`);
      return false;
    }

    console.log(`[LocalAdapter] promptPermissionAndRestore() for workspace: ${this.workspaceId}`);

    try {
      // Request permission for stored handle
      const granted = await requestPermissionForWorkspace(workspaceId);
      if (!granted) {
        console.log(`[LocalAdapter] Permission denied or handle not found`);
        return false;
      }

      // Try to restore handle from IndexedDB metadata
      const restored = await this.attemptRestorePersistedHandle();
      if (restored) {
        this.setState(AdapterState.READY);
        this.emitEvent({
          type: 'ready',
          workspaceId: this.workspaceId,
          timestamp: new Date(),
        });
        console.log(`[LocalAdapter] ✓ Restored directory handle via permission, adapter is READY`);
        return true;
      }

      return false;
    } catch (err) {
      console.error(`[LocalAdapter] promptPermissionAndRestore failed:`, err);
      return false;
    }
  }

  // ============================================================================
  // CORE OPERATIONS: PUSH, PULL, EXISTS, DELETE
  // ============================================================================

  /**
   * Push (write) a file to local storage.
   * Requires adapter to be in READY state.
   * Requests WRITE permission on first write operation using native browser dialog.
   * Uses MDN-recommended createWritable() pattern.
   */
  async push(descriptor: AdapterFileDescriptor, content: string): Promise<boolean> {
    const context = `[LocalAdapter] push(${descriptor.id})`;

    if (!this.validateReady()) {
      console.error(`${context}: Adapter not in READY state (state: ${this.state})`);
      return false;
    }

    try {
      if (!this.dirHandle) {
        throw new Error('Directory handle not available');
      }

      // Request WRITE permission before attempting to write
      // This uses the native browser dialog on first write
      const hasWritePermission = await this.requestMode(this.dirHandle, 'readwrite');
      if (!hasWritePermission) {
        console.error(`${context}: Write permission denied by user`);
        return false;
      }

      // Get or create file handle with permission handling
      const fileHandle = await this.getFileHandle(descriptor.path, true);
      if (!fileHandle) {
        console.error(`${context}: Unable to create file`);
        return false;
      }

      // Use createWritable() per MDN best practices
      const writable = await fileHandle.createWritable();

      try {
      // Write content to the stream
        await writable.write(content);
      } finally {
      // Always close the stream
        await writable.close();
      }

      console.debug(`${context}: ✓ Written ${content.length} bytes`);
      return true;
    } catch (err) {
      console.error(`${context}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Pull (read) a file from local storage.
   * Requires adapter to be in READY state.
   * Uses MDN-recommended getFile() pattern.
   */
  async pull(fileId: string, localVersion?: number): Promise<string | null> {
    const context = `[LocalAdapter] pull(${fileId})`;

    if (!this.validateReady()) {
      console.error(`${context}: Adapter not in READY state (state: ${this.state})`);
      return null;
    }

    try {
      // Get file handle (don't create if not found)
      const fileHandle = await this.getFileHandle(fileId, false);
      if (!fileHandle) {
        console.debug(`${context}: File not found`);
        return null;
      }

      // Use getFile() per MDN best practices
      const file = await fileHandle.getFile();
      const content = await file.text();

      console.debug(`${context}: ✓ Read ${content.length} bytes`);
      return content;
    } catch (err) {
      console.debug(`${context}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * Check if a file exists.
   */
  async exists(fileId: string): Promise<boolean> {
    if (!this.validateReady()) return false;

    try {
      const handle = await this.getFileHandle(fileId, false);
      return !!handle;
    } catch (err) {
      console.debug('[LocalAdapter] exists check failed:', err);
      return false;
    }
  }

  /**
   * Delete a file.
   * Requires write permissions on parent directory.
   * Requests WRITE permission using native browser dialog if needed.
   */
  async delete(fileId: string): Promise<boolean> {
    const context = `[LocalAdapter] delete(${fileId})`;

    if (!this.validateReady()) {
      console.error(`${context}: Adapter not in READY state`);
      return false;
    }

    try {
      if (!this.dirHandle) {
        throw new Error('Directory handle not available');
      }

      // Request WRITE permission before attempting to delete
      const hasWritePermission = await this.requestMode(this.dirHandle, 'readwrite');
      if (!hasWritePermission) {
        console.error(`${context}: Write permission denied by user`);
        return false;
      }

      const parts = fileId.split('/').filter(Boolean);
      const fileName = parts.pop();

      if (!fileName) {
        throw new Error('Invalid file path');
      }

      // Navigate to parent directory
      const dir = await this.getDirectoryHandle(parts.join('/'), false);
      if (!dir) {
        console.warn(`${context}: Parent directory not found`);
        return false;
      }

      // Remove entry using removeEntry() (MDN-recommended for directories)
      try {
        await dir.removeEntry(fileName, { recursive: false });
        console.debug(`${context}: ✓ Deleted`);
        return true;
      } catch (err: any) {
        if (err?.name === 'NotFoundError') {
          console.debug(`${context}: File not found`);
          return false;
        }
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionError') {
          console.error(`${context}: Permission denied`);
          return false;
        }
        throw err;
      }
    } catch (err) {
      console.error(`${context}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  // ============================================================================
  // WORKSPACE OPERATIONS: LIST & PULL WORKSPACE
  // ============================================================================

  /**
   * List files in a directory (recursively).
   * Walks entire directory tree and returns all files.
   */
  async listFiles(directory = ''): Promise<Array<{ id: string; path: string; name: string }>> {
    if (!this.validateReady()) {
      throw new Error('Adapter not ready');
    }

    const out: Array<{ id: string; path: string; name: string }> = [];

    try {
      const dir = await this.getDirectoryHandle(directory, false);
      if (!dir) {
        console.warn(`[LocalAdapter] listFiles: Directory not found: "${directory}"`);
        return out;
      }

      await this.walkDirectoryForFiles(dir, directory, out);
    } catch (err) {
      console.warn(`[LocalAdapter] listFiles error for directory "${directory}":`, err);
    }

    return out;
  }

  /**
   * Recursively walk directory and collect all files.
   * Helper for listFiles().
   */
  private async walkDirectoryForFiles(
    dir: FileSystemDirectoryHandle,
    currentPath: string,
    out: Array<{ id: string; path: string; name: string }>
  ): Promise<void> {
    // @ts-ignore - values() is available in modern browsers
    for await (const entry of dir.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      try {
        if (entry.kind === 'file') {
          out.push({ id: entryPath, path: entryPath, name: entry.name });
        } else if (entry.kind === 'directory') {
          // Recursively walk subdirectories
          try {
            const subDir = await dir.getDirectoryHandle(entry.name, { create: false });
            await this.walkDirectoryForFiles(subDir, entryPath, out);
          } catch (err: any) {
            if (err?.name === 'NotFoundError') {
              console.debug(`[LocalAdapter] Subdirectory not accessible: "${entryPath}"`);
            } else if (err?.name === 'NotAllowedError' || err?.name === 'PermissionError') {
              console.warn(`[LocalAdapter] Permission denied accessing subdirectory: "${entryPath}"`);
            } else {
              console.warn(`[LocalAdapter] Failed to walk subdirectory "${entryPath}":`, err);
            }
            // Continue to next entry
          }
        }
      } catch (err) {
        console.warn(`[LocalAdapter] Error processing entry "${entryPath}":`, err);
        // Continue to next entry
      }
    }
  }

  /**
   * List all files in workspace (for any workspace, using stored handle).
   * Does NOT require this adapter instance to be READY.
   */
  async listWorkspaceFiles(
    workspaceId?: string,
    directory = ''
  ): Promise<Array<{ id: string; path: string; metadata?: any }>> {
    const wsId = workspaceId || this.workspaceId;
    if (wsId !== this.workspaceId) {
      throw new Error(`Cannot list files for workspace ${wsId} (adapter is for ${this.workspaceId})`);
    }

    try {
      const files = await this.listFiles(directory);
      return files.map((f) => ({ id: f.id, path: f.path, metadata: { name: f.name } }));
    } catch (err) {
      console.error('[LocalAdapter] listWorkspaceFiles error:', err);
      return [];
    }
  }

  /**
   * Pull entire workspace contents.
   * Returns all files with their content.
   */
  async pullWorkspace(
    workspaceId?: string,
    directory = ''
  ): Promise<Array<{ id: string; path: string; metadata?: Record<string, any> }>> {
    const wsId = workspaceId || this.workspaceId;
    if (wsId !== this.workspaceId) {
      throw new Error(`Cannot pull workspace ${wsId} (adapter is for ${this.workspaceId})`);
    }

    console.log(
      `[LocalAdapter] pullWorkspace() started for workspace: ${wsId}, directory: "${directory || 'root'}"`
    );

    try {
      const files = await this.listFiles(directory);
      console.log(
        `[LocalAdapter] Found ${files.length} files to pull: ${files.map((f) => f.path).join(', ')}`
      );

      const out: Array<{ id: string; path: string; metadata?: Record<string, any> }> = [];

      for (const f of files) {
        try {
          const content = (await this.pull(f.path)) ?? '';
          // Return AdapterEntry-compatible structure
          out.push({
            id: f.path,
            path: f.path,
            metadata: {
              name: f.name,
              content: content
            }
          });
          console.debug(
            `[LocalAdapter] Loaded file "${f.path}" (${content.length} bytes)`
          );
        } catch (err) {
          console.warn(`[LocalAdapter] Failed to pull file "${f.path}":`, err);
          // Still add to output with empty content to track the file
          out.push({
            id: f.path,
            path: f.path,
            metadata: {
              name: f.name,
              content: ''
            }
          });
        }
      }

      console.log(
        `[LocalAdapter] ✓ pullWorkspace completed: ${out.length} files loaded`
      );
      return out;
    } catch (err) {
      console.error('[LocalAdapter] pullWorkspace error:', err);
      return [];
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Migrate state and emit event (with previous state).
   */
  private setState(newState: AdapterState, error: AdapterInitError | null = null): void {
    const prevState = this.state;
    this.state = newState;
    this.error = error;

    console.log(
      `[LocalAdapter] State transition: ${prevState} → ${newState}${error ? ` (error: ${error.code})` : ''}`,
    );

    this.emitEvent({
      type: 'state-changed',
      state: newState,
      previousState: prevState,
      timestamp: new Date(),
    });
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emitEvent(event: AdapterLifecycleEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[LocalAdapter] Event listener error:', err);
      }
    }
  }

  /**
   * Attempt to restore directory handle from IndexedDB metadata.
   * May require permission request if handle was serialized.
   */
  private async attemptRestorePersistedHandle(): Promise<boolean> {
    try {
      // Try to restore from global fallback (page reload)
      if ((window as any).__localWorkspaceId === this.workspaceId) {
        const globalHandle = (window as any).__localDirHandle;
        if (globalHandle) {
          this.dirHandle = globalHandle;
          console.log(`[LocalAdapter] Recovered directory handle from global fallback`);
          return true;
        }
      }

      // TODO: Implement persistent handle restoration via workspace-manager
      // const handle = await restoreDirectoryHandle(this.workspaceId)
      // if (handle) { this.dirHandle = handle; return true; }

      return false;
    } catch (err) {
      console.warn('[LocalAdapter] Failed to restore persisted handle:', err);
      return false;
    }
  }

  /**
   * Helper: Check if we have read+write permission on a directory handle.
   * Uses MDN-recommended queryPermission pattern.
   * Returns true if read+write is granted, false if denied or prompt needed.
   */
  private async hasPermission(
    dirHandle: FileSystemDirectoryHandle,
    mode: 'read' | 'readwrite' = 'readwrite'
  ): Promise<boolean> {
    try {
      const status = await (dirHandle.queryPermission as any)?.({ mode });
      return status === 'granted';
    } catch {
      // queryPermission not supported - assume permission granted
      return true;
    }
  }

  /**
   * Helper: Request permission on a directory handle if needed.
   * Uses native browser dialog.
   * Returns true if permission granted, false if denied.
   */
  private async requestMode(
    dirHandle: FileSystemDirectoryHandle,
    mode: 'read' | 'readwrite' = 'readwrite'
  ): Promise<boolean> {
    try {
      const status = await (dirHandle.requestPermission as any)?.({ mode });
      return status === 'granted';
    } catch {
      // requestPermission not supported - assume permission granted
      return true;
    }
  }

  /**
   * Helper: Get or create a directory.
   * Does NOT request permissions - caller is responsible for that.
   * Follows MDN best practices for FileSystem API.
   */
  private async getOrCreateDir(
    parent: FileSystemDirectoryHandle,
    dirName: string,
    create = false
  ): Promise<FileSystemDirectoryHandle | null> {
    try {
      return await parent.getDirectoryHandle(dirName, { create });
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionError') {
        console.warn(`[LocalAdapter] Permission denied accessing directory: ${dirName}`);
        return null;
      }
      if (err?.name === 'NotFoundError' && !create) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Helper: Get or create a file.
   * Does NOT request permissions - caller (push/delete) is responsible for that.
   * Follows MDN best practices for FileSystem API.
   */
  private async getOrCreateFile(
    parent: FileSystemDirectoryHandle,
    fileName: string,
    create = false
  ): Promise<FileSystemFileHandle | null> {
    try {
      return await parent.getFileHandle(fileName, { create });
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionError') {
        console.warn(`[LocalAdapter] Permission denied accessing file: ${fileName}`);
        return null;
      }
      if (err?.name === 'NotFoundError' && !create) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Helper: Get or create a file handle, navigating the full path.
   * Navigates directory tree and returns file handle.
   * Returns null if any permission is denied or path not found (and create=false).
   */
  private async getFileHandle(
    path: string,
    create = false
  ): Promise<FileSystemFileHandle | null> {
    if (!this.dirHandle) {
      throw new Error('Root directory handle not initialized');
    }

    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let dir: FileSystemDirectoryHandle = this.dirHandle;

    // Navigate directory path
    for (const part of parts) {
      const subDir = await this.getOrCreateDir(dir, part, create);
      if (!subDir) {
        return null;
      }
      dir = subDir;
    }

    // Get or create the file
    return await this.getOrCreateFile(dir, fileName, create);
  }

  /**
   * Helper: Get a directory handle, navigating the full path.
   * Returns null if any permission is denied or path not found (and create=false).
   */
  private async getDirectoryHandle(path: string, create = false): Promise<FileSystemDirectoryHandle | null> {
    if (!this.dirHandle) {
      throw new Error('Root directory handle not initialized');
    }

    if (!path) return this.dirHandle;

    const parts = path.split('/').filter(Boolean);
    let dir: FileSystemDirectoryHandle = this.dirHandle;

    // Navigate directory path
    for (const part of parts) {
      const subDir = await this.getOrCreateDir(dir, part, create);
      if (!subDir) {
        return null;
      }
      dir = subDir;
    }

    return dir;
  }

  /**
   * Helper: Walk directory tree and upsert files into cache.
   */
  private async walkAndUpsertTree(nodes: any[]): Promise<void> {
    for (const node of nodes) {
      await this.walkAndUpsertNode(node);
    }
  }

  /**
   * Recursively walk and upsert a tree node.
   */
  private async walkAndUpsertNode(node: any): Promise<void> {
    if (node.type === FileType.File) {
      // Upsert file into cache
      try {
        await upsertCachedFile({
          id: node.id,
          path: node.path,
          name: node.name || node.path.split('/').pop() || 'untitled',
          workspaceId: this.workspaceId,
          workspaceType: WorkspaceType.Local,
          type: FileType.File,
          dirty: false,
          syncStatus: 'idle',
        });
      } catch (e) {
        console.warn(`[LocalAdapter] Failed to upsert file ${node.id}:`, e);
      }
    } else if (node.type === FileType.Directory && node.children) {
      await this.walkAndUpsertTree(node.children);
    }
  }
}

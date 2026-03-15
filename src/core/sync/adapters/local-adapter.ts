/**
 * LocalAdapter — simplified v2 adapter for local filesystem workspaces.
 *
 * Follows the Chrome File System Access API workflow:
 * https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
 *
 * Implements IAdapter: pull (filesystem → RxDB), push (RxDB → filesystem),
 * ensurePermission (public, call from user-gesture handler), filter contract,
 * and destroy (short-circuits any in-flight pull via _destroyed flag).
 *
 * Permission flow:
 *  1. _verifyPermission() — single helper that calls queryPermission then
 *     requestPermission (matching the Chrome docs pattern exactly).
 *  2. ensureHandle() — checks in-memory handle, then the IDB-persisted handle;
 *     for 'readwrite' mode falls back to window.confirm() before throwing.
 *  3. ensurePermission() — user-gesture entry: checks in-memory → IDB restore →
 *     showDirectoryPicker() as last resort.
 *
 * Handle persistence is delegated to handle-store.ts (vanilla IndexedDB, no Dexie).
 * Filter rules are loaded from workspace-ignore.json at module load time.
 */

import type { IAdapter } from '../adapter';
import { getHandle, setHandle, removeHandle } from '../handle-store';
import { upsertCachedFile } from '@/core/cache/file-manager';
import { FileType, WorkspaceType } from '@/core/cache/types';
import ignoreConfig from '../workspace-ignore.json';

/**
 * Thrown by ensureHandle() when no granted filesystem permission exists.
 * SyncManager catches this and sets permissionNeeded:true on the workspace store
 * so the UI can render a "Grant Access" button that calls ensurePermission().
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

type PermissionMode = 'read' | 'readwrite';

export class LocalAdapter implements IAdapter {
  readonly workspaceId: string;
  readonly type = 'local' as const;

  private _dirHandle: FileSystemDirectoryHandle | null = null;
  private _destroyed = false;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ---------------------------------------------------------------------------
  // Static helpers — used by directory-handler.ts to avoid direct IDB imports
  // ---------------------------------------------------------------------------

  /**
   * Returns true when a persisted FileSystemDirectoryHandle exists in IndexedDB
   * for the given workspace. Does NOT verify that the handle still has permission.
   */
  static async hasPersistedHandle(workspaceId: string): Promise<boolean> {
    const handle = await getHandle(workspaceId);
    return handle != null;
  }

  /**
   * Removes the persisted FileSystemDirectoryHandle for the given workspace
   * from IndexedDB. Used when clearing / deleting a local workspace.
   */
  static async clearPersistedHandle(workspaceId: string): Promise<void> {
    await removeHandle(workspaceId);
  }

  // ---------------------------------------------------------------------------
  // IAdapter — filter contract
  // ---------------------------------------------------------------------------

  /** @inheritdoc */
  shouldIncludeFolder(name: string): boolean {
    return !ignoreConfig.ignoreFolders.includes(name);
  }

  /** @inheritdoc */
  shouldIncludeFile(path: string, name: string, sizeBytes: number): boolean {
    if (ignoreConfig.ignoreNames.includes(name)) return false;
    const ext = name.includes('.') ? `.${name.split('.').pop()!.toLowerCase()}` : '';
    if (ext && ignoreConfig.ignoreExtensions.includes(ext)) return false;
    if (sizeBytes > ignoreConfig.maxFileSizeMB * 1024 * 1024) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // IAdapter — pull / push / ensurePermission / destroy
  // ---------------------------------------------------------------------------

  /**
   * Walks the directory tree and upserts every included file into RxDB
   * with dirty:false, isSynced:true.
   *
   * @param signal - Checked before each directory level to short-circuit stale
   *   pulls on rapid workspace switches.
   */
  async pull(signal?: AbortSignal): Promise<void> {
    const handle = await this.ensureHandle('read');
    await this._walkDir(handle, '', signal);
  }

  /**
   * Writes content to the workspace-relative path on the local filesystem,
   * creating intermediate directories as needed.
   */
  async push(path: string, content: string): Promise<void> {
    const rootHandle = await this.ensureHandle('readwrite');
    const segments = path.split('/').filter(Boolean);
    const fileName = segments.pop()!;

    let dir: FileSystemDirectoryHandle = rootHandle;
    for (const seg of segments) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }

    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
  }

  /**
   * Ensures readwrite permission is granted for the workspace directory,
   * restoring from IndexedDB when possible, otherwise opening the native
   * directory picker.
   *
   * MUST be called from a direct user-gesture handler (e.g. a button click)
   * because requestPermission() / showDirectoryPicker() require a live user
   * activation in all supporting browsers.
   *
   * @returns true if readwrite permission was obtained, false if the user cancelled.
   */
  async ensurePermission(): Promise<boolean> {
    try {
      // 1. Try in-memory cached handle first.
      if (this._dirHandle && (await this._verifyPermission(this._dirHandle, 'readwrite'))) {
        return true;
      }

      // 2. Try the IDB-persisted handle — avoids triggering a picker on reload.
      const persisted = await getHandle(this.workspaceId);
      if (persisted && (await this._verifyPermission(persisted, 'readwrite'))) {
        this._dirHandle = persisted;
        return true;
      }

      // 3. No usable handle — open the native directory picker.
      if (!('showDirectoryPicker' in window)) return false;
      const picked: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      this._dirHandle = picked;
      await setHandle(this.workspaceId, picked);
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
      throw err;
    }
  }

  /**
   * Marks the adapter as destroyed and releases the directory handle.
   * Any in-flight _walkDir stops at its next iteration check.
   */
  destroy(): void {
    this._destroyed = true;
    this._dirHandle = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Verifies (and if needed requests) permission for a handle — the canonical
   * Chrome File System Access API helper pattern.
   * https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
   *
   * Calls queryPermission first; only calls requestPermission when the status
   * is not already 'granted', matching the MDN / Chrome docs approach of not
   * guarding on a specific 'prompt' value (future statuses won't silently skip).
   *
   * @returns true if the handle has (or was just granted) the requested permission.
   */
  private async _verifyPermission(
    handle: FileSystemDirectoryHandle,
    mode: PermissionMode,
  ): Promise<boolean> {
    const opts = { mode };
    if ((await (handle as any).queryPermission(opts)) === 'granted') return true;
    // requestPermission() must be called in a user-activation context;
    // it is a no-op in background frames and will resolve to 'denied'.
    if ((await (handle as any).requestPermission(opts)) === 'granted') return true;
    return false;
  }

  /**
   * Returns a granted directory handle for the requested access mode.
   *
   * Tries the in-memory cached handle first, then the IndexedDB-persisted handle.
   * For 'readwrite' mode: if neither source yields a granted handle, shows a
   * native window.confirm() so the user can approve before a final retry. This
   * covers the case where the tab regained focus without a direct button click.
   *
   * @throws {PermissionError} when no granted handle can be obtained.
   */
  private async ensureHandle(mode: PermissionMode): Promise<FileSystemDirectoryHandle> {
    // In-memory handle.
    if (this._dirHandle && (await this._verifyPermission(this._dirHandle, mode))) {
      return this._dirHandle;
    }

    // IDB-persisted handle.
    const persisted = await getHandle(this.workspaceId);
    if (persisted && (await this._verifyPermission(persisted, mode))) {
      this._dirHandle = persisted;
      return persisted;
    }

    // For write access: give the user one confirm-based chance to approve
    // before failing. This surfaces a clear message without a custom toast.
    if (mode === 'readwrite' && typeof window !== 'undefined') {
      const allow = window.confirm(
        'Verve needs write access to save changes to your local workspace.\n\nClick OK to grant permission.',
      );
      if (allow) {
        // Re-attempt with the persisted handle after the confirm gesture.
        const retryHandle = persisted ?? this._dirHandle;
        if (retryHandle && (await this._verifyPermission(retryHandle, mode))) {
          this._dirHandle = retryHandle;
          return retryHandle;
        }
      }
    }

    throw new PermissionError(
      `No granted ${mode} permission for workspace "${this.workspaceId}". ` +
        'Call adapter.ensurePermission() during a user gesture.',
    );
  }

  /**
   * Recurses the directory tree, upserting each included file into RxDB.
   *
   * @param dirHandle - The directory to walk.
   * @param prefix    - Accumulated relative path prefix for nested entries.
   * @param signal    - AbortSignal to short-circuit stale traversals.
   */
  private async _walkDir(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted || this._destroyed) return;

    for await (const [name, entry] of (dirHandle as any)) {
      if (signal?.aborted || this._destroyed) return;

      if (entry.kind === 'directory') {
        if (!this.shouldIncludeFolder(name)) continue;
        const childPrefix = prefix ? `${prefix}/${name}` : name;
        await this._walkDir(entry as FileSystemDirectoryHandle, childPrefix, signal);
      } else {
        const relPath = prefix ? `${prefix}/${name}` : name;
        const file: File = await (entry as FileSystemFileHandle).getFile();
        if (!this.shouldIncludeFile(relPath, name, file.size)) continue;

        if (signal?.aborted || this._destroyed) return;

        const content = await file.text();

        await upsertCachedFile({
          id: this._fileId(relPath),
          path: relPath,
          name,
          type: FileType.File,
          workspaceId: this.workspaceId,
          workspaceType: WorkspaceType.Local,
          content,
          size: file.size,
          dirty: false,
          isSynced: true,
          modifiedAt: new Date(file.lastModified).toISOString(),
        });
      }
    }
  }

  /**
   * Returns a workspace-scoped, deterministic file ID so the same path always
   * maps to the same RxDB document across repeated pulls.
   */
  private _fileId(relPath: string): string {
    return `${this.workspaceId}:${relPath}`;
  }
}

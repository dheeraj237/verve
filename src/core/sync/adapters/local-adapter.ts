import { Observable } from 'rxjs';
import { ISyncAdapter } from '../sync-manager';
import type { CachedFile } from '../../cache/types';
import { requestPermissionForWorkspace, storeDirectoryHandle as workspaceStoreDirectoryHandle } from '@/core/cache/workspace-manager';
import { buildFileTreeFromDirectory } from '@/features/file-explorer/store/helpers/file-tree-builder';
import { upsertCachedFile } from '@/core/cache/rxdb';
import { saveFile } from '@/core/cache/file-manager';
import { CachedFile as CachedFileType, WorkspaceType } from '@/core/cache/types';

/**
 * Browser-friendly Local Adapter using the File System Access API.
 * Keeps the same adapter contract as the previous Node/Electron adapter
 * but performs all operations via the browser API. Adapter manages its
 * own internal `rootHandle` and does not rely on global window state.
 */
export class LocalAdapter implements ISyncAdapter {
  name = 'local';
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private fileHandles = new Map<string, FileSystemFileHandle>();

  constructor() { }

  /**
   * Initialize adapter with a directory handle (optional).
   */
  async initialize(directoryHandle?: FileSystemDirectoryHandle): Promise<void> {
    if (directoryHandle) {
      this.rootHandle = directoryHandle;
      await this.loadFileHandles();
      return;
    }
    // Not initialized; adapters that call this should handle errors.
    throw new Error('Local directory not initialized. Please provide a directory handle.');
  }

  /**
   * User-gesture: open directory picker and initialize adapter with chosen handle.
   * Stores handle in IndexedDB and loads file handles cache.
   */
  async openDirectoryPicker(workspaceId?: string): Promise<void> {
    if (!('showDirectoryPicker' in window)) throw new Error('Directory picker not supported');
    const dirHandle = await (window as any).showDirectoryPicker();
    if (workspaceId) {
      try {
        await workspaceStoreDirectoryHandle(workspaceId, dirHandle);
      } catch (e) {
        console.warn('Failed to store directory handle via workspace-manager:', e);
      }
    }
    // Initialize adapter internal handle
    this.rootHandle = dirHandle;
    await this.loadFileHandles();
    // Scan the directory and upsert discovered files into RxDB/cache
    try {
      const tree = await buildFileTreeFromDirectory(dirHandle);
      // Walk tree and upsert files' metadata and content
      const self = this;
      async function walkAndUpsert(node: any) {
        if (node.type === 'file' || node.type === 'File') {
          try {
            const filePath = node.path;
            // read content via file handle
            const fileHandle = await (self as any).getFileHandle(filePath, false).catch(() => undefined);
            let content = '';
            if (fileHandle) {
              const f = await fileHandle.getFile();
              content = await f.text();
            }
            const cached: CachedFileType = {
              id: filePath,
              name: node.name,
              path: filePath,
              type: 'file',
              workspaceType: WorkspaceType.Local,
              workspaceId: workspaceId || undefined,
              content,
              lastModified: Date.now(),
              dirty: false,
            } as any;
            await upsertCachedFile(cached).catch((e) => console.warn('upsertCachedFile failed', e));
            await saveFile(filePath, content, WorkspaceType.Local, undefined, workspaceId).catch((e) => console.warn('saveFile failed', e));
          } catch (e) {
            console.warn('walkAndUpsert file error', e);
          }
        }
        const children = node.children || [];
        for (const c of children) await walkAndUpsert.call(this, c);
      }

      for (const r of tree) {
        await walkAndUpsert.call(this, r);
      }
    } catch (e) {
      console.warn('Failed to scan and upsert local directory into RxDB:', e);
    }
  }

  /**
   * User-gesture: request permission for a previously stored handle and initialize adapter.
   */
  async promptPermissionAndRestore(workspaceId: string): Promise<boolean> {
    try {
      const handle = await requestPermissionForWorkspace(workspaceId);
      if (!handle) return false;
      // Ensure workspace-manager persists metadata for the restored handle
      try { await workspaceStoreDirectoryHandle(workspaceId, handle); } catch (e) { /* ignore */ }
      // Initialize internal handle
      this.rootHandle = handle;
      await this.loadFileHandles();
      return true;
    } catch (e) {
      console.warn('promptPermissionAndRestore failed:', e);
      return false;
    }
  }

  /**
   * Return true when adapter has been initialized with a root handle.
   */
  isReady(): boolean {
    return !!this.rootHandle;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.rootHandle) return;
    throw new Error('Local directory not initialized');
  }

  async push(file: CachedFile, content: string): Promise<boolean> {
    const context = `${this.name}::push(${file.id})`;
    try {
      await this.ensureInitialized();

      const fileHandle = await this.getFileHandle(file.path, true);
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Update cache
      this.fileHandles.set(file.path, fileHandle);
      return true;
    } catch (err) {
      console.error(`${context}: File operation failed - ${err}`);
      return false;
    }
  }

  async pull(fileId: string): Promise<string | null> {
    try {
      await this.ensureInitialized();
      const fileHandle = await this.getFileHandle(fileId, false);
      if (!fileHandle) return null;
      const file = await fileHandle.getFile();
      const content = await file.text();
      return content;
    } catch (err) {
      return null;
    }
  }

  async exists(fileId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const handle = await this.getFileHandle(fileId, false);
      return !!handle;
    } catch {
      return false;
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const parts = fileId.split('/').filter(Boolean);
      const fileName = parts.pop()!;
      let dir = this.rootHandle as FileSystemDirectoryHandle;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part);
      }
      await dir.removeEntry(fileName);
      this.fileHandles.delete(fileId);
      return true;
    } catch (err) {
      return false;
    }
  }

  // Optional: list files in a directory (non-recursive)
  async listFiles(directory = ''): Promise<Array<{ id: string; path: string; name: string }>> {
    await this.ensureInitialized();
    const dir = await this.getDirectoryHandle(directory);
    const out: Array<{ id: string; path: string; name: string }> = [];
    // @ts-ignore
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        const filePath = directory ? `${directory}/${entry.name}` : entry.name;
        out.push({ id: filePath, path: filePath, name: entry.name });
      }
    }
    return out;
  }

  // Backwards-compatible workspace-level helpers expected by SyncManager
  async listWorkspaceFiles(_workspaceId?: string, directory = ''): Promise<Array<{ id: string; path: string; metadata?: any }>> {
    const files = await this.listFiles(directory);
    return files.map(f => ({ id: f.id, path: f.path, metadata: { name: f.name } }));
  }

  async pullWorkspace(_workspaceId?: string, directory = ''): Promise<Array<{ fileId: string; content: string }>> {
    const files = await this.listFiles(directory);
    const out: Array<{ fileId: string; content: string }> = [];
    for (const f of files) {
      const content = (await this.pull(f.path)) ?? '';
      out.push({ fileId: f.path, content });
    }
    return out;
  }

  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle | undefined> {
    if (!this.rootHandle) throw new Error('Root not initialized');
    const cached = this.fileHandles.get(path);
    if (cached && !create) return cached;

    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    const fileHandle = await dir.getFileHandle(fileName, { create });
    this.fileHandles.set(path, fileHandle);
    return fileHandle;
  }

  private async getDirectoryHandle(path: string, create = false): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) throw new Error('Root not initialized');
    if (!path) return this.rootHandle;
    const parts = path.split('/').filter(Boolean);
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }

  private async loadFileHandles(dirHandle?: FileSystemDirectoryHandle, basePath = ''): Promise<void> {
    const dir = dirHandle || this.rootHandle;
    if (!dir) return;
    // @ts-ignore
    for await (const entry of dir.values()) {
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        this.fileHandles.set(entryPath, entry as FileSystemFileHandle);
      } else if (entry.kind === 'directory') {
        await this.loadFileHandles(entry as FileSystemDirectoryHandle, entryPath);
      }
    }
  }
}

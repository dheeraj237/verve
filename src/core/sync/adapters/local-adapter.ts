import { Observable } from 'rxjs';
import { ISyncAdapter } from '../sync-manager';
import type { CachedFile } from '../../cache/types';

/**
 * Browser-friendly Local Adapter using the File System Access API.
 * Keeps the same adapter contract as the previous Node/Electron adapter
 * but performs all operations via the browser API (uses a previously
 * stored directory handle at `window.__localDirHandle`).
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

    const globalHandle = (window as any).__localDirHandle;
    if (globalHandle) {
      this.rootHandle = globalHandle;
      await this.loadFileHandles();
      return;
    }

    // Not initialized; adapters that call this should handle errors.
    throw new Error('Local directory not initialized. Please provide a directory handle.');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.rootHandle) return;
    const globalHandle = (window as any).__localDirHandle;
    if (globalHandle) {
      await this.initialize(globalHandle);
      return;
    }
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

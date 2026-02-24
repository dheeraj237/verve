/**
 * Local Adapter V2 - Uses File System Access API
 */

import { WorkspaceAdapter, WorkspaceType, FileData, FileMetadata, AdapterCapabilities } from '../types';
import { FileSystemError, FileErrorType } from '../errors';

/**
 * Local file system adapter using File System Access API
 */
export class LocalAdapterV2 implements WorkspaceAdapter {
  type = WorkspaceType.LOCAL;
  capabilities: AdapterCapabilities = {
    supportsWatch: false,
    supportsBatch: false,
    supportsVersioning: true,
    supportsRename: true,
    supportsDirectories: true,
    maxFileSize: 100 * 1024 * 1024, // 100MB
  };

  private rootHandle: FileSystemDirectoryHandle | null = null;
  private fileHandles = new Map<string, FileSystemFileHandle>();
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize with a directory handle
   */
  async initialize(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      this.rootHandle = directoryHandle;
      await this.loadFileHandles();
    })();

    return this.initializationPromise;
  }

  /**
   * Ensure adapter is initialized (checks for global directory handle if not yet initialized)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.rootHandle) {
      return;
    }

    // Check for global directory handle
    const globalHandle = (window as any).__localDirHandle;
    if (globalHandle) {
      await this.initialize(globalHandle);
      return;
    }

    throw new FileSystemError(
      FileErrorType.ADAPTER_ERROR,
      '',
      'Local directory not initialized. Please select a directory.'
    );
  }

  /**
   * Read a file
   */
  async readFile(path: string): Promise<FileData> {
    await this.ensureInitialized();

    try {
      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();
      const content = await file.text();

      return {
        id: path,
        path,
        name: file.name,
        category: this.getCategoryFromPath(path),
        content,
        size: file.size,
        lastModified: new Date(file.lastModified),
        version: file.lastModified.toString(),
      };
    } catch (error) {
      throw new FileSystemError(
        FileErrorType.NOT_FOUND,
        path,
        `Failed to read file: ${error}`,
        false
      );
    }
  }

  /**
   * Write a file
   */
  async writeFile(path: string, content: string, version?: string): Promise<string | void> {
    await this.ensureInitialized();

    try {
      // Check version conflict if provided
      if (version) {
        const fileHandle = await this.getFileHandle(path, false);
        if (fileHandle) {
          const file = await fileHandle.getFile();
          if (file.lastModified.toString() !== version) {
            throw new FileSystemError(
              FileErrorType.CONFLICT,
              path,
              'Version conflict detected'
            );
          }
        }
      }

      const fileHandle = await this.getFileHandle(path, true);
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      this.fileHandles.set(path, fileHandle);
    } catch (error: any) {
      if (error instanceof FileSystemError) throw error;
      
      throw new FileSystemError(
        FileErrorType.PERMISSION_DENIED,
        path,
        `Failed to write file: ${error}`,
        false
      );
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const parts = path.split('/').filter(Boolean);
      const fileName = parts.pop()!;
      
      let dirHandle = this.rootHandle;
      for (const part of parts) {
        dirHandle = await dirHandle.getDirectoryHandle(part);
      }
      
      await dirHandle.removeEntry(fileName);
      this.fileHandles.delete(path);
    } catch (error) {
      throw new FileSystemError(
        FileErrorType.NOT_FOUND,
        path,
        `Failed to delete file: ${error}`
      );
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(directory = ''): Promise<FileMetadata[]> {
    await this.ensureInitialized();

    try {
      const files: FileMetadata[] = [];
      const dirHandle = await this.getDirectoryHandle(directory);
      
      // @ts-ignore - values() exists but not in all TS definitions
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const filePath = directory ? `${directory}/${entry.name}` : entry.name;
          
          files.push({
            id: filePath,
            path: filePath,
            name: entry.name,
            category: this.getCategoryFromPath(filePath),
            size: file.size,
            lastModified: new Date(file.lastModified),
          });
        }
      }
      
      return files;
    } catch (error) {
      throw new FileSystemError(
        FileErrorType.NOT_FOUND,
        directory,
        `Failed to list files: ${error}`
      );
    }
  }

  /**
   * Rename a file
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const fileData = await this.readFile(oldPath);
    await this.writeFile(newPath, fileData.content);
    await this.deleteFile(oldPath);
  }

  /**
   * Create a folder
   */
  async createFolder(path: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.getDirectoryHandle(path, true);
    } catch (error) {
      throw new FileSystemError(
        FileErrorType.PERMISSION_DENIED,
        path,
        `Failed to create folder: ${error}`
      );
    }
  }

  /**
   * Get file version (lastModified timestamp)
   */
  async getFileVersion(path: string): Promise<string | undefined> {
    try {
      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();
      return file.lastModified.toString();
    } catch {
      return undefined;
    }
  }

  /**
   * Get or create a file handle
   */
  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    if (!this.rootHandle) {
      throw new Error('Root directory not initialized');
    }

    const cached = this.fileHandles.get(path);
    if (cached && !create) return cached;

    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    
    let dirHandle = this.rootHandle;
    for (const part of parts) {
      dirHandle = await dirHandle.getDirectoryHandle(part, { create });
    }
    
    const fileHandle = await dirHandle.getFileHandle(fileName, { create });
    this.fileHandles.set(path, fileHandle);
    
    return fileHandle;
  }

  /**
   * Get a directory handle
   */
  private async getDirectoryHandle(path: string, create = false): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) {
      throw new Error('Root directory not initialized');
    }

    if (!path) return this.rootHandle;

    const parts = path.split('/').filter(Boolean);
    let dirHandle = this.rootHandle;
    
    for (const part of parts) {
      dirHandle = await dirHandle.getDirectoryHandle(part, { create });
    }
    
    return dirHandle;
  }

  /**
   * Load all file handles recursively
   */
  private async loadFileHandles(dirHandle?: FileSystemDirectoryHandle, basePath = ''): Promise<void> {
    const dir = dirHandle || this.rootHandle;
    if (!dir) return;

    try {
      // @ts-ignore - values() exists but not in all TS definitions
      for await (const entry of dir.values()) {
        const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
        
        if (entry.kind === 'file') {
          this.fileHandles.set(entryPath, entry as FileSystemFileHandle);
        } else if (entry.kind === 'directory') {
          await this.loadFileHandles(entry as FileSystemDirectoryHandle, entryPath);
        }
      }
    } catch (error) {
      console.warn('Failed to load file handles:', error);
    }
  }

  /**
   * Get category from path
   */
  private getCategoryFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : 'root';
  }
}

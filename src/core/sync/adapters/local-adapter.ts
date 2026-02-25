import { Observable } from 'rxjs';
import { ISyncAdapter } from '../sync-manager';
import type { CachedFile } from '../../cache/types';

/**
 * Local file system adapter
 * For electron/desktop environments with file system access
 * Syncs files to the local filesystem and watches for changes
 */
export class LocalAdapter implements ISyncAdapter {
  name = 'local';
  private baseDir: string;
  private fileVersionCache = new Map<string, number>(); // Track file versions for change detection

  constructor(baseDir: string = './') {
    this.baseDir = baseDir;
  }

  /**
   * Push local changes to the file system
   */
  async push(file: CachedFile, content: string): Promise<boolean> {
    const context = `${this.name}::push(${file.id})`;
    try {
      const filePath = this.getFullPath(file.path);

      // Dynamic import to avoid requiring Node.js at module load time
      let fs: any;
      let path: any;
      try {
        fs = await import('fs').then((m) => m.promises);
        path = await import('path');
      } catch (importError) {
        console.warn(
          `${context}: File system APIs not available (expected in browser). ` +
          'LocalAdapter requires Node.js/Electron runtime.'
        );
        return false;
      }

      try {
        // Create directory structure if needed
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, { recursive: true });

        // Write file (UTF-8 text)
        await fs.writeFile(filePath, content, 'utf8');

        // Update version cache
        const stat = await fs.stat(filePath);
        this.fileVersionCache.set(file.id, stat.mtimeMs);

        console.log(`${context}: Successfully wrote file to ${filePath}`);
        return true;
      } catch (fileError) {
        const err = fileError instanceof Error ? fileError : new Error(String(fileError));
        console.error(`${context}: File operation failed - ${err.message}`);
        throw err;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`${context}: ${err.message}`);
      return false;
    }
  }

  /**
   * Pull remote changes from file system
   */
  async pull(fileId: string, localVersion?: number): Promise<string | null> {
    const context = `${this.name}::pull(${fileId})`;
    try {
      let fs: any;
      try {
        fs = await import('fs').then((m) => m.promises);
      } catch (importError) {
        // Not in Node.js/Electron environment
        return null;
      }

      try {
        // Check cached version
        const cachedVersion = this.fileVersionCache.get(fileId);
        if (localVersion && cachedVersion && cachedVersion <= localVersion) {
          // File hasn't changed since local version
          return null;
        }

        // TODO: Resolve fileId to actual file path from cachedFile metadata
        // For now, return null to indicate no changes
        return null;
      } catch (fileError) {
        const err = fileError instanceof Error ? fileError : new Error(String(fileError));
        if ((err as any).code === 'ENOENT') {
          // File doesn't exist
          return null;
        }
        console.warn(`${context}: File operation warning - ${err.message}`);
        return null;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`${context}: ${err.message}`);
      return null;
    }
  }

  /**
   * Check if file exists in file system
   */
  async exists(fileId: string): Promise<boolean> {
    const context = `${this.name}::exists(${fileId})`;
    try {
      let fs: any;
      try {
        fs = await import('fs').then((m) => m.promises);
      } catch (importError) {
        return false;
      }

      try {
        // TODO: Resolve fileId to file path
        // For now, return false
        return false;
      } catch (fileError) {
        const err = fileError instanceof Error ? fileError : new Error(String(fileError));
        if ((err as any).code === 'ENOENT') {
          return false;
        }
        console.warn(`${context}: ${err.message}`);
        return false;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`${context}: ${err.message}`);
      return false;
    }
  }

  /**
   * Delete file from file system
   */
  async delete(fileId: string): Promise<boolean> {
    const context = `${this.name}::delete(${fileId})`;
    try {
      let fs: any;
      try {
        fs = await import('fs').then((m) => m.promises);
      } catch (importError) {
        return false;
      }

      try {
        // TODO: Resolve fileId to file path
        // await fs.unlink(filePath);
        this.fileVersionCache.delete(fileId);
        console.log(`${context}: File deleted`);
        return true;
      } catch (fileError) {
        const err = fileError instanceof Error ? fileError : new Error(String(fileError));
        if ((err as any).code === 'ENOENT') {
          // Already deleted
          this.fileVersionCache.delete(fileId);
          return true;
        }
        console.error(`${context}: ${err.message}`);
        return false;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`${context}: ${err.message}`);
      return false;
    }
  }

  /**
   * Watch file system for changes
   * Emits fileId when file is modified
   */
  watch?(): Observable<string> {
    return new Observable<string>((subscriber) => {
      const context = 'LocalAdapter::watch()';

      (async () => {
        try {
          // Dynamic import of chokidar - optional dependency for file watching
          let chokidarModule: any;
          try {
            chokidarModule = await (Function('return import("chokidar")')() as Promise<any>);
          } catch (importError) {
            console.info(
              `${context}: chokidar not available (optional dependency). ` +
              'Install with: npm install chokidar'
            );
            subscriber.complete();
            return;
          }

          try {
            const watcher = chokidarModule.default.watch(this.baseDir, {
              ignored: /(^|[\\/\\])\\.|node_modules/,
              persistent: true,
              awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
              }
            });

            watcher.on('change', (path: string) => {
              try {
                const fileId = this.pathToFileId(path);
                console.log(`${context}: File changed - ${fileId}`);
                subscriber.next(fileId);
              } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                console.error(`${context}: Error processing change - ${err.message}`);
              }
            });

            watcher.on('error', (error: Error) => {
              console.error(`${context}: Watcher error - ${error.message}`);
              subscriber.error(error);
            });

            console.log(`${context}: File system watcher started for ${this.baseDir}`);

            // Return cleanup function
            return () => {
              watcher.close();
            };
          } catch (watchError) {
            const err = watchError instanceof Error ? watchError : new Error(String(watchError));
            console.error(`${context}: Failed to start watcher - ${err.message}`);
            subscriber.error(err);
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`${context}: ${err.message}`);
          subscriber.error(err);
        }
      })();

      return () => {
        console.log(`${context}: Watcher stopped`);
      };
    });
  }

  /**
   * Optional: list files for a local workspace. Returns empty array by default.
   */
  async listWorkspaceFiles(workspaceId?: string, path?: string): Promise<{ id: string; path: string; metadata?: any }[]> {
    try {
      const subpath = path || '';
      const files = await this.listFilesRecursive(subpath);
      return files.map((fullPath) => {
        const relative = fullPath.startsWith(this.baseDir) ? fullPath.slice(this.baseDir.length) : fullPath;
        const normalized = relative.replace(/\\/g, '/');
        const fileId = normalized.startsWith('/') ? normalized : '/' + normalized;
        return { id: fileId, path: fileId, metadata: {} };
      });
    } catch (err) {
      console.warn('LocalAdapter.listWorkspaceFiles failed:', err);
      return [];
    }
  }

  /**
   * Optional: pull multiple files for a workspace. Returns empty array by default.
   */
  async pullWorkspace(workspaceId?: string, path?: string): Promise<Array<{ fileId: string; yjsState: Uint8Array }>> {
    try {
      const fs = await import('fs').then((m) => m.promises);
      const subpath = path || '';
      const files = await this.listFilesRecursive(subpath);
      const items: Array<{ fileId: string; content: string }> = [];
      for (const fullPath of files) {
        try {
          const buf = await fs.readFile(fullPath);
          const relative = fullPath.startsWith(this.baseDir) ? fullPath.slice(this.baseDir.length) : fullPath;
          const normalized = relative.replace(/\\/g, '/');
          const fileId = normalized.startsWith('/') ? normalized : '/' + normalized;
          items.push({ fileId, content: buf.toString('utf-8') });
        } catch (err) {
          console.warn('LocalAdapter.pullWorkspace: failed to read file', fullPath, err);
        }
      }
      return items;
    } catch (err) {
      console.warn('LocalAdapter.pullWorkspace failed:', err);
      return [];
    }
  }

  /**
   * Helper: construct full file path
   */
  private getFullPath(relativePath: string): string {
    const path = require('path');
    return path.join(this.baseDir, relativePath);
  }

  /**
   * Recursively list files under the adapter baseDir (or optional subpath).
   */
  private async listFilesRecursive(subpath: string = ''): Promise<string[]> {
    let fs: any;
    let pathModule: any;
    try {
      fs = await import('fs').then((m) => m.promises);
      pathModule = await import('path');
    } catch (e) {
      return [];
    }

    const root = this.getFullPath(subpath || '');
    const results: string[] = [];

    async function walk(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = pathModule.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.isFile()) {
            results.push(full);
          }
        }
      } catch (err) {
        // ignore errors per-file
      }
    }

    await walk(root);
    return results;
  }

  /**
   * Helper: convert file path to fileId
   */
  private pathToFileId(filePath: string): string {
    // Remove base directory prefix and normalize path separators
    let fileId = filePath.startsWith(this.baseDir)
      ? filePath.slice(this.baseDir.length)
      : filePath;

    // Normalize path separators to forward slashes
    fileId = fileId.replace(/\\/g, '/');

    // Ensure leading slash
    if (!fileId.startsWith('/')) {
      fileId = '/' + fileId;
    }

    return fileId;
  }
}

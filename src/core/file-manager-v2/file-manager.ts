/**
 * Unified File Manager V2 - Central orchestrator for all file operations
 */

import { WorkspaceAdapter, FileData, FileMetadata, WorkspaceType } from './types';
import { FileCache } from './file-cache';
import { SyncQueue } from './sync-queue';
import { CACHE_CONFIG, DEBOUNCE_CONFIG } from './constants';

/**
 * Central file manager that coordinates cache, sync queue, and adapters
 */
export class FileManager {
  private adapter: WorkspaceAdapter;
  private cache: FileCache;
  private syncQueue: SyncQueue;

  constructor(adapter: WorkspaceAdapter) {
    this.adapter = adapter;
    this.cache = new FileCache();
    this.syncQueue = new SyncQueue(adapter);
  }

  /**
   * Load a file - checks cache first, then fetches from adapter
   */
  async loadFile(path: string): Promise<FileData> {
    const cached = this.cache.get(path);
    
    if (cached && !this.shouldRefresh(cached)) {
      return cached;
    }

    const fileData = await this.adapter.readFile(path);
    
    this.cache.set(path, {
      ...fileData,
      isDirty: false,
      syncStatus: 'idle',
      lastSync: Date.now(),
      lastAccess: Date.now(),
    });

    return fileData;
  }

  /**
   * Update file content - optimistic update with background sync
   */
  async updateFile(path: string, content: string, immediate = false): Promise<void> {
    const cached = this.cache.get(path);
    const version = cached?.version;

    // Optimistic update
    this.cache.set(path, {
      id: cached?.id || path,
      path,
      name: this.getFileName(path),
      category: this.getCategoryFromPath(path),
      content,
      version,
      isDirty: true,
      syncStatus: 'idle',
      lastSync: cached?.lastSync || Date.now(),
      lastAccess: Date.now(),
    });

    // Queue for background sync
    this.syncQueue.enqueue({
      type: 'update',
      path,
      content,
      version,
      timestamp: Date.now(),
      debounceMs: immediate ? DEBOUNCE_CONFIG.userSave : DEBOUNCE_CONFIG.autoSave,
    });
  }

  /**
   * Create a new file
   */
  async createFile(path: string, content = ''): Promise<void> {
    this.cache.set(path, {
      id: path,
      path,
      name: this.getFileName(path),
      category: this.getCategoryFromPath(path),
      content,
      isDirty: true,
      syncStatus: 'idle',
      lastSync: Date.now(),
      lastAccess: Date.now(),
    });

    // Invalidate directory index so file tree refreshes
    const directory = this.getDirectoryFromPath(path);
    this.cache.invalidateDirectoryIndex(directory);

    this.syncQueue.enqueue({
      type: 'create',
      path,
      content,
      timestamp: Date.now(),
      debounceMs: DEBOUNCE_CONFIG.create,
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    this.cache.remove(path);

    // Invalidate directory index so file tree refreshes
    const directory = this.getDirectoryFromPath(path);
    this.cache.invalidateDirectoryIndex(directory);

    this.syncQueue.enqueue({
      type: 'delete',
      path,
      timestamp: Date.now(),
      debounceMs: DEBOUNCE_CONFIG.delete,
    });
  }

  /**
   * Rename a file
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const cached = this.cache.get(oldPath);
    
    if (cached) {
      this.cache.rename(oldPath, newPath);
    }

    // Invalidate directory indexes for both old and new locations
    const oldDirectory = this.getDirectoryFromPath(oldPath);
    const newDirectory = this.getDirectoryFromPath(newPath);
    this.cache.invalidateDirectoryIndex(oldDirectory);
    if (oldDirectory !== newDirectory) {
      this.cache.invalidateDirectoryIndex(newDirectory);
    }

    this.syncQueue.enqueue({
      type: 'rename',
      path: oldPath,
      newPath,
      timestamp: Date.now(),
      debounceMs: DEBOUNCE_CONFIG.rename,
    });
  }

  /**
   * List files in a directory
   */
  async listFiles(directory = ''): Promise<FileMetadata[]> {
    const cachedIndex = this.cache.getDirectoryIndex(directory);
    
    if (cachedIndex && !this.shouldRefreshIndex(directory)) {
      return cachedIndex;
    }

    const files = await this.adapter.listFiles(directory);
    this.cache.setDirectoryIndex(directory, files);
    
    return files;
  }

  /**
   * Create a folder
   */
  async createFolder(path: string): Promise<void> {
    if (!this.adapter.capabilities.supportsDirectories) {
      throw new Error('Adapter does not support directories');
    }

    // Invalidate directory index so new folder appears
    const parentDirectory = this.getDirectoryFromPath(path);
    this.cache.invalidateDirectoryIndex(parentDirectory);

    this.syncQueue.enqueue({
      type: 'create-folder',
      path,
      timestamp: Date.now(),
      debounceMs: 0,
    });
  }

  /**
   * Switch to a different workspace adapter
   */
  async switchAdapter(newAdapter: WorkspaceAdapter, flushQueue = true): Promise<void> {
    console.log(`[FileManager] Switching from ${this.adapter.type} to ${newAdapter.type}`);
    
    if (flushQueue) {
      await this.syncQueue.waitForIdle();
    }

    this.adapter = newAdapter;
    this.syncQueue.setAdapter(newAdapter);
    this.cache.clear();
    
    console.log(`[FileManager] Switched to ${newAdapter.type}`);
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return this.syncQueue.getStatus();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Force sync of a specific file
   */
  async forceSync(path: string): Promise<void> {
    await this.syncQueue.processByPath(path);
  }

  /**
   * Invalidate cache for a path
   */
  invalidateCache(path: string): void {
    this.cache.remove(path);
  }

  /**
   * Subscribe to sync status changes
   */
  subscribeSyncStatus(listener: (status: any) => void) {
    return this.syncQueue.subscribe(listener);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.syncQueue.dispose();
    this.cache.clear();
  }

  /**
   * Check if cached file should be refreshed
   */
  private shouldRefresh(cached: any): boolean {
    if (cached.isDirty) return false;
    
    const fiveMinutes = CACHE_CONFIG.ttl;
    return Date.now() - cached.lastSync > fiveMinutes;
  }

  /**
   * Check if directory index should be refreshed
   */
  private shouldRefreshIndex(directory: string): boolean {
    const lastRefresh = this.cache.getDirectoryIndexTime(directory);
    if (!lastRefresh) return true;
    
    return Date.now() - lastRefresh > 30000; // 30 seconds
  }

  /**
   * Extract filename from path
   */
  private getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  /**
   * Derive category from path
   */
  private getCategoryFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : 'root';
  }

  /**
   * Get directory path from file path
   */
  private getDirectoryFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    parts.pop(); // Remove filename
    return parts.join('/');
  }
}

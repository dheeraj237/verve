/**
 * In-memory file cache with LRU eviction
 */

import { FileData, FileMetadata } from './types';
import { CACHE_CONFIG } from './constants';

interface CachedFile extends FileData {
  isDirty: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSync: number;
  lastAccess: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
}

/**
 * File cache that stores files in memory with LRU eviction
 */
export class FileCache {
  private files = new Map<string, CachedFile>();
  private directoryIndex = new Map<string, FileMetadata[]>();
  private directoryIndexTime = new Map<string, number>();
  private maxSize: number;
  private maxMemory: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = CACHE_CONFIG.maxSize, maxMemory = CACHE_CONFIG.maxMemory) {
    this.maxSize = maxSize;
    this.maxMemory = maxMemory;
  }

  /**
   * Get a file from cache
   */
  get(path: string): CachedFile | null {
    const file = this.files.get(path);
    if (file) {
      file.lastAccess = Date.now();
      this.hits++;
      return file;
    }
    this.misses++;
    return null;
  }

  /**
   * Set a file in cache
   */
  set(path: string, file: Partial<CachedFile> & FileData): void {
    const existing = this.files.get(path);
    const cachedFile: CachedFile = {
      ...existing,
      ...file,
      // Prefer explicit values provided in `file`, then fall back to existing, then defaults
      isDirty: (file as Partial<CachedFile>).isDirty ?? existing?.isDirty ?? false,
      syncStatus: (file as Partial<CachedFile>).syncStatus ?? existing?.syncStatus ?? 'idle',
      lastSync: (file as Partial<CachedFile>).lastSync ?? existing?.lastSync ?? Date.now(),
      lastAccess: Date.now(),
    };
    
    this.files.set(path, cachedFile);
    this.evictIfNeeded();
  }

  /**
   * Update an existing cached file
   */
  update(path: string, updates: Partial<CachedFile>): void {
    const existing = this.files.get(path);
    if (!existing) return;

    this.files.set(path, {
      ...existing,
      ...updates,
      lastAccess: Date.now(),
    });
  }

  /**
   * Remove a file from cache
   */
  remove(path: string): void {
    this.files.delete(path);
  }

  /**
   * Rename a file in cache
   */
  rename(oldPath: string, newPath: string): void {
    const file = this.files.get(oldPath);
    if (!file) return;

    this.files.delete(oldPath);
    this.files.set(newPath, {
      ...file,
      path: newPath,
      lastAccess: Date.now(),
    });
  }

  /**
   * Get directory index
   */
  getDirectoryIndex(directory: string): FileMetadata[] | null {
    return this.directoryIndex.get(directory) || null;
  }

  /**
   * Set directory index
   */
  setDirectoryIndex(directory: string, files: FileMetadata[]): void {
    this.directoryIndex.set(directory, files);
    this.directoryIndexTime.set(directory, Date.now());
  }

  /**
   * Get directory index timestamp
   */
  getDirectoryIndexTime(directory: string): number | null {
    return this.directoryIndexTime.get(directory) || null;
  }

  /**
   * Invalidate directory index
   */
  invalidateDirectoryIndex(directory: string = ''): void {
    // Invalidate the specific directory
    this.directoryIndex.delete(directory);
    this.directoryIndexTime.delete(directory);

    // Also invalidate parent directories and root
    if (directory) {
      const parts = directory.split('/').filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        const parentDir = parts.slice(0, i).join('/');
        this.directoryIndex.delete(parentDir);
        this.directoryIndexTime.delete(parentDir);
      }
    }

    // Always invalidate root
    this.directoryIndex.delete('');
    this.directoryIndexTime.delete('');
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.files.clear();
    this.directoryIndex.clear();
    this.directoryIndexTime.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const memoryUsage = this.calculateMemoryUsage();
    const total = this.hits + this.misses;
    return {
      size: this.files.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      memoryUsage,
    };
  }

  /**
   * Get all dirty files
   */
  getDirtyFiles(): CachedFile[] {
    return Array.from(this.files.values()).filter(f => f.isDirty);
  }

  /**
   * Mark file as synced
   */
  markSynced(path: string, version?: string): void {
    this.update(path, {
      isDirty: false,
      syncStatus: 'idle',
      lastSync: Date.now(),
      version,
    });
  }

  /**
   * Mark file as syncing
   */
  markSyncing(path: string): void {
    this.update(path, { syncStatus: 'syncing' });
  }

  /**
   * Mark file as error
   */
  markError(path: string): void {
    this.update(path, { syncStatus: 'error' });
  }

  /**
   * Evict files if cache exceeds limits
   */
  private evictIfNeeded(): void {
    if (this.files.size <= this.maxSize) {
      const memoryUsage = this.calculateMemoryUsage();
      if (memoryUsage <= this.maxMemory) return;
    }

    const toEvict = Math.max(1, Math.floor(this.maxSize * 0.1));
    this.evictLRU(toEvict);
  }

  /**
   * Evict least recently used files
   */
  private evictLRU(count: number): void {
    const entries = Array.from(this.files.entries())
      .filter(([_, file]) => !file.isDirty)
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
      .slice(0, count);

    entries.forEach(([path]) => this.files.delete(path));
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): number {
    let total = 0;
    this.files.forEach(file => {
      total += file.content.length * 2; // UTF-16 chars
      total += 1000; // metadata overhead
    });
    return total;
  }
}

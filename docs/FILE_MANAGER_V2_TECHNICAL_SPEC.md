# File Manager V2 - Technical Specification

## Overview

This document provides detailed technical specifications for implementing the unified File Manager V2 architecture. It complements the [architecture document](./FILE_MANAGER_V2_ARCHITECTURE.md) with concrete implementation details.

---

## Core Components Implementation

### 1. File Manager Core

**Location:** `src/core/file-manager-v2/file-manager.ts`

```typescript
/**
 * Unified File Manager V2
 * Central orchestrator for all file operations across different workspace types
 */

import { WorkspaceAdapter, FileData, FileMetadata, SyncOperation } from './types';
import { FileCache } from './file-cache';
import { SyncQueue } from './sync-queue';
import { WorkspaceType } from '@/shared/types';

export class FileManager {
  private adapter: WorkspaceAdapter;
  private cache: FileCache;
  private syncQueue: SyncQueue;
  private workspaceType: WorkspaceType;

  constructor(adapter: WorkspaceAdapter) {
    this.adapter = adapter;
    this.cache = new FileCache();
    this.syncQueue = new SyncQueue(adapter);
    this.workspaceType = adapter.type;
  }

  /**
   * Load a file - checks cache first, then fetches from adapter
   */
  async loadFile(path: string): Promise<FileData> {
    // Check cache
    const cached = this.cache.get(path);
    
    if (cached && !this.shouldRefresh(cached)) {
      console.log(`[FileManager] Cache hit: ${path}`);
      return cached.toFileData();
    }

    // Cache miss or stale - fetch from adapter
    console.log(`[FileManager] Fetching from adapter: ${path}`);
    const fileData = await this.adapter.readFile(path);
    
    // Update cache
    this.cache.set(path, {
      ...fileData,
      isDirty: false,
      syncStatus: 'idle',
      lastSync: Date.now(),
    });

    return fileData;
  }

  /**
   * Update file content - optimistic update + background sync
   */
  async updateFile(path: string, content: string, immediate = false): Promise<void> {
    const cached = this.cache.get(path);
    
    if (!cached) {
      throw new Error(`File not loaded: ${path}`);
    }

    // Optimistic update - update cache immediately
    this.cache.update(path, {
      content,
      isDirty: true,
      syncStatus: 'idle',
    });

    console.log(`[FileManager] Optimistic update: ${path}`);

    // Enqueue sync operation
    const operation: SyncOperation = {
      type: 'update',
      path,
      content,
      timestamp: Date.now(),
      debounceMs: immediate ? 0 : 2000, // immediate for Cmd+S, 2s for auto-save
      version: cached.version,
    };

    this.syncQueue.enqueue(operation);
  }

  /**
   * Create a new file
   */
  async createFile(path: string, content = ''): Promise<void> {
    // Add to cache immediately (optimistic)
    this.cache.set(path, {
      id: `temp-${Date.now()}`,
      path,
      name: this.getFileName(path),
      content,
      category: this.getCategoryFromPath(path),
      version: '0',
      isDirty: true,
      syncStatus: 'idle',
      lastSync: Date.now(),
    });

    // Enqueue creation
    const operation: SyncOperation = {
      type: 'create',
      path,
      content,
      timestamp: Date.now(),
      debounceMs: 100,
    };

    this.syncQueue.enqueue(operation);
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    // Remove from cache immediately
    this.cache.remove(path);

    // Enqueue deletion
    const operation: SyncOperation = {
      type: 'delete',
      path,
      timestamp: Date.now(),
      debounceMs: 0, // immediate
    };

    this.syncQueue.enqueue(operation);
  }

  /**
   * Rename a file
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const cached = this.cache.get(oldPath);
    
    if (!cached) {
      throw new Error(`File not loaded: ${oldPath}`);
    }

    // Update cache
    this.cache.rename(oldPath, newPath);

    // Enqueue rename
    const operation: SyncOperation = {
      type: 'rename',
      path: oldPath,
      newPath,
      timestamp: Date.now(),
      debounceMs: 0, // immediate
    };

    this.syncQueue.enqueue(operation);
  }

  /**
   * List files in a directory
   */
  async listFiles(directory: string): Promise<FileMetadata[]> {
    // Check if we have cached index
    const cached = this.cache.getDirectoryIndex(directory);
    
    if (cached && !this.shouldRefreshIndex(directory)) {
      console.log(`[FileManager] Index cache hit: ${directory}`);
      return cached;
    }

    // Fetch from adapter
    console.log(`[FileManager] Fetching directory: ${directory}`);
    const files = await this.adapter.listFiles(directory);
    
    // Update index cache
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

    if (!this.adapter.createFolder) {
      throw new Error('Adapter does not implement createFolder');
    }

    // Enqueue folder creation
    const operation: SyncOperation = {
      type: 'create-folder',
      path,
      timestamp: Date.now(),
      debounceMs: 0, // immediate
    };

    this.syncQueue.enqueue(operation);
  }

  /**
   * Switch to a different workspace adapter
   */
  async switchAdapter(newAdapter: WorkspaceAdapter, flushQueue = true): Promise<void> {
    console.log(`[FileManager] Switching from ${this.adapter.type} to ${newAdapter.type}`);

    // Wait for pending operations to complete
    if (flushQueue) {
      await this.syncQueue.waitForIdle();
    }

    // Clear cache
    this.cache.clear();

    // Switch adapter
    this.adapter = newAdapter;
    this.workspaceType = newAdapter.type;
    this.syncQueue.setAdapter(newAdapter);

    console.log(`[FileManager] Adapter switched to ${newAdapter.type}`);
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      pendingOperations: this.syncQueue.getPendingCount(),
      isProcessing: this.syncQueue.isProcessing(),
      queueStatus: this.syncQueue.getStatus(),
    };
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
   * Check if cached file should be refreshed
   */
  private shouldRefresh(cached: any): boolean {
    // Refresh if dirty (has unsaved changes) - never refresh
    if (cached.isDirty) return false;

    // Refresh if last sync was more than 5 minutes ago
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - cached.lastSync > fiveMinutes;
  }

  /**
   * Check if directory index should be refreshed
   */
  private shouldRefreshIndex(directory: string): boolean {
    const lastRefresh = this.cache.getDirectoryIndexTime(directory);
    if (!lastRefresh) return true;

    // Refresh if last refresh was more than 30 seconds ago
    return Date.now() - lastRefresh > 30000;
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
   * Cleanup resources
   */
  dispose() {
    this.syncQueue.dispose();
    this.cache.clear();
  }
}
```

---

### 2. File Cache Implementation

**Location:** `src/core/file-manager-v2/file-cache.ts`

```typescript
/**
 * In-Memory File Cache with LRU Eviction
 */

import { FileData, FileMetadata } from './types';

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

export class FileCache {
  private files: Map<string, CachedFile> = new Map();
  private directoryIndex: Map<string, FileMetadata[]> = new Map();
  private directoryIndexTime: Map<string, number> = new Map();
  private maxSize: number;
  private maxMemory: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 100, maxMemory = 50 * 1024 * 1024) {
    this.maxSize = maxSize;
    this.maxMemory = maxMemory;
  }

  /**
   * Get a file from cache
   */
  get(path: string): CachedFile | null {
    const file = this.files.get(path);
    
    if (file) {
      this.hits++;
      file.lastAccess = Date.now();
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
      ...file,
      isDirty: file.isDirty ?? false,
      syncStatus: file.syncStatus ?? 'idle',
      lastSync: file.lastSync ?? Date.now(),
      lastAccess: Date.now(),
    };

    this.files.set(path, cachedFile);

    // Evict if necessary
    this.evictIfNeeded();
  }

  /**
   * Update an existing cached file
   */
  update(path: string, updates: Partial<CachedFile>): void {
    const existing = this.files.get(path);
    
    if (!existing) {
      throw new Error(`File not in cache: ${path}`);
    }

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
    
    if (!file) {
      throw new Error(`File not in cache: ${oldPath}`);
    }

    this.files.delete(oldPath);
    this.files.set(newPath, {
      ...file,
      path: newPath,
      name: newPath.split('/').pop() || newPath,
      lastAccess: Date.now(),
    });
  }

  /**
   * Get directory index (file list)
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
   * Get directory index last update time
   */
  getDirectoryIndexTime(directory: string): number | null {
    return this.directoryIndexTime.get(directory) || null;
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
    const totalAccesses = this.hits + this.misses;
    
    return {
      size: this.files.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalAccesses > 0 ? this.hits / totalAccesses : 0,
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
    const file = this.files.get(path);
    
    if (file) {
      file.isDirty = false;
      file.syncStatus = 'idle';
      file.lastSync = Date.now();
      if (version) {
        file.version = version;
      }
    }
  }

  /**
   * Mark file as syncing
   */
  markSyncing(path: string): void {
    const file = this.files.get(path);
    if (file) {
      file.syncStatus = 'syncing';
    }
  }

  /**
   * Mark file as error
   */
  markError(path: string): void {
    const file = this.files.get(path);
    if (file) {
      file.syncStatus = 'error';
    }
  }

  /**
   * Evict least recently used files if cache is over capacity
   */
  private evictIfNeeded(): void {
    // Check size limit
    if (this.files.size > this.maxSize) {
      this.evictLRU(this.files.size - this.maxSize);
    }

    // Check memory limit
    const memoryUsage = this.calculateMemoryUsage();
    if (memoryUsage > this.maxMemory) {
      // Evict 10% of cache
      this.evictLRU(Math.ceil(this.files.size * 0.1));
    }
  }

  /**
   * Evict N least recently used files (skip dirty files)
   */
  private evictLRU(count: number): void {
    const sortedEntries = Array.from(this.files.entries())
      .filter(([_, file]) => !file.isDirty) // Don't evict dirty files
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
      const [path] = sortedEntries[i];
      console.log(`[Cache] Evicting: ${path}`);
      this.files.delete(path);
    }
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): number {
    let total = 0;
    
    for (const file of this.files.values()) {
      // Rough estimation: content size + metadata overhead
      total += (file.content?.length || 0) * 2; // UTF-16 = 2 bytes per char
      total += 1000; // ~1KB overhead per file for metadata
    }

    return total;
  }
}
```

---

### 3. Sync Queue Implementation

**Location:** `src/core/file-manager-v2/sync-queue.ts`

```typescript
/**
 * Sync Queue - Reliable Background Synchronization
 */

import { WorkspaceAdapter, SyncOperation, SyncOperationStatus } from './types';

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

export class SyncQueue {
  private adapter: WorkspaceAdapter;
  private queue: SyncOperation[] = [];
  private processing = false;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryConfig: RetryConfig;
  private listeners: Set<(status: QueueStatus) => void> = new Set();
  private storageKey = 'verve_sync_queue_v2';

  constructor(adapter: WorkspaceAdapter, retryConfig = DEFAULT_RETRY_CONFIG) {
    this.adapter = adapter;
    this.retryConfig = retryConfig;
    this.loadQueue();
  }

  /**
   * Enqueue a sync operation
   */
  enqueue(operation: Omit<SyncOperation, 'id' | 'status' | 'retries'>): string {
    // Cancel existing debounce timer for this path
    const existingTimer = this.debounceTimers.get(operation.path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Create operation with ID
    const id = this.generateOperationId(operation);
    const syncOp: SyncOperation = {
      ...operation,
      id,
      status: 'pending',
      retries: 0,
    };

    // Remove duplicate pending operations for the same path
    this.removeDuplicates(operation.path, operation.type);

    // Add to queue
    this.queue.push(syncOp);
    this.saveQueue();

    console.log(`[SyncQueue] Enqueued: ${operation.type} ${operation.path}`);

    // Debounce processing
    if (operation.debounceMs && operation.debounceMs > 0) {
      const timer = setTimeout(() => {
        this.debounceTimers.delete(operation.path);
        this.processQueue();
      }, operation.debounceMs);

      this.debounceTimers.set(operation.path, timer);
    } else {
      // Process immediately
      this.processQueue();
    }

    return id;
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      console.log('[SyncQueue] Already processing');
      return;
    }

    const pendingOp = this.queue.find(op => op.status === 'pending');
    if (!pendingOp) {
      console.log('[SyncQueue] No pending operations');
      this.notifyListeners();
      return;
    }

    this.processing = true;
    pendingOp.status = 'processing';
    this.notifyListeners();

    console.log(`[SyncQueue] Processing: ${pendingOp.type} ${pendingOp.path}`);

    try {
      await this.executeOperation(pendingOp);
      
      // Success
      pendingOp.status = 'completed';
      console.log(`[SyncQueue] Completed: ${pendingOp.type} ${pendingOp.path}`);
      
    } catch (error) {
      console.error(`[SyncQueue] Error: ${pendingOp.type} ${pendingOp.path}`, error);
      
      pendingOp.error = error instanceof Error ? error.message : String(error);
      
      // Retry logic
      if (this.shouldRetry(pendingOp, error)) {
        pendingOp.retries++;
        pendingOp.status = 'pending';
        
        const delay = this.calculateRetryDelay(pendingOp.retries);
        console.log(`[SyncQueue] Retrying in ${delay}ms (attempt ${pendingOp.retries})`);
        
        setTimeout(() => this.processQueue(), delay);
      } else {
        pendingOp.status = 'failed';
        console.error(`[SyncQueue] Failed permanently: ${pendingOp.path}`);
      }
    }

    this.processing = false;
    this.saveQueue();
    this.notifyListeners();

    // Process next operation
    setTimeout(() => this.processQueue(), 100);
  }

  /**
   * Execute a single operation via adapter
   */
  private async executeOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        await this.adapter.writeFile(operation.path, operation.content || '');
        break;

      case 'update':
        await this.adapter.writeFile(operation.path, operation.content || '', operation.version);
        break;

      case 'delete':
        await this.adapter.deleteFile(operation.path);
        break;

      case 'rename':
        if (this.adapter.renameFile && operation.newPath) {
          await this.adapter.renameFile(operation.path, operation.newPath);
        } else {
          throw new Error('Adapter does not support rename');
        }
        break;

      case 'create-folder':
        if (this.adapter.createFolder) {
          await this.adapter.createFolder(operation.path);
        } else {
          throw new Error('Adapter does not support createFolder');
        }
        break;

      default:
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
  }

  /**
   * Check if operation should be retried
   */
  private shouldRetry(operation: SyncOperation, error: unknown): boolean {
    if (operation.retries >= this.retryConfig.maxRetries) {
      return false;
    }

    // Check if error is retryable
    const errorMessage = error instanceof Error ? error.message : String(error);
    const retryableErrors = [
      'network',
      'timeout',
      'rate limit',
      'server error',
      '429',
      '500',
      '503',
    ];

    return retryableErrors.some(pattern => 
      errorMessage.toLowerCase().includes(pattern)
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retries: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, retries - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Wait for queue to become idle (all operations completed or failed)
   */
  async waitForIdle(timeoutMs = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkIdle = () => {
        const pending = this.queue.filter(op => 
          op.status === 'pending' || op.status === 'processing'
        );

        if (pending.length === 0) {
          resolve();
        } else {
          setTimeout(checkIdle, 100);
        }
      };

      checkIdle();
      setTimeout(() => reject(new Error('Timeout waiting for queue idle')), timeoutMs);
    });
  }

  /**
   * Process operations for a specific path
   */
  async processByPath(path: string): Promise<void> {
    const operations = this.queue.filter(op => op.path === path && op.status === 'pending');
    
    for (const op of operations) {
      if (this.processing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await this.processQueue();
    }
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    return {
      pending: this.queue.filter(op => op.status === 'pending').length,
      processing: this.queue.filter(op => op.status === 'processing').length,
      completed: this.queue.filter(op => op.status === 'completed').length,
      failed: this.queue.filter(op => op.status === 'failed').length,
      isProcessing: this.processing,
    };
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.queue.filter(op => op.status === 'pending' || op.status === 'processing').length;
  }

  /**
   * Check if queue is processing
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Set a different adapter
   */
  setAdapter(adapter: WorkspaceAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Clear all completed operations from queue
   */
  clearCompleted(): void {
    this.queue = this.queue.filter(op => op.status !== 'completed');
    this.saveQueue();
  }

  /**
   * Cancel a pending operation
   */
  cancel(operationId: string): boolean {
    const op = this.queue.find(o => o.id === operationId);
    
    if (op && op.status === 'pending') {
      this.queue = this.queue.filter(o => o.id !== operationId);
      this.saveQueue();
      return true;
    }

    return false;
  }

  /**
   * Retry a failed operation
   */
  retry(operationId: string): void {
    const op = this.queue.find(o => o.id === operationId);
    
    if (op && op.status === 'failed') {
      op.status = 'pending';
      op.retries = 0;
      op.error = undefined;
      this.saveQueue();
      this.processQueue();
    }
  }

  /**
   * Remove duplicate operations for the same path
   */
  private removeDuplicates(path: string, type: SyncOperationStatus['type']): void {
    this.queue = this.queue.filter(op => 
      !(op.path === path && op.type === type && op.status === 'pending')
    );
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(operation: any): string {
    return `${operation.type}-${operation.path}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Subscribe to queue status changes
   */
  subscribe(listener: (status: QueueStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Load queue from persistent storage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        
        // Reset processing status on load
        this.queue.forEach(op => {
          if (op.status === 'processing') {
            op.status = 'pending';
          }
        });
        
        console.log(`[SyncQueue] Loaded ${this.queue.length} operations from storage`);
      }
    } catch (error) {
      console.error('[SyncQueue] Failed to load queue:', error);
    }
  }

  /**
   * Save queue to persistent storage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[SyncQueue] Failed to save queue:', error);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clear listeners
    this.listeners.clear();
    
    // Save final state
    this.saveQueue();
  }
}
```

---

### 4. Type Definitions

**Location:** `src/core/file-manager-v2/types.ts`

```typescript
/**
 * Type definitions for File Manager V2
 */

export enum WorkspaceType {
  LOCAL = 'local',
  DEMO = 'demo',
  GOOGLE_DRIVE = 'google-drive',
  // Future types
  S3 = 's3',
  GITHUB = 'github',
  DROPBOX = 'dropbox',
}

export interface FileMetadata {
  id: string;
  path: string;
  name: string;
  category: string;
  size?: number;
  lastModified?: Date;
  mimeType?: string;
}

export interface FileData extends FileMetadata {
  content: string;
  version?: string;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'rename' | 'create-folder';
  path: string;
  newPath?: string; // for rename
  content?: string; // for create/update
  version?: string; // for conflict detection
  timestamp: number;
  debounceMs?: number;
  retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface AdapterCapabilities {
  supportsWatch: boolean;
  supportsBatch: boolean;
  supportsVersioning: boolean;
  supportsRename: boolean;
  supportsDirectories: boolean;
  maxFileSize: number;
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
}

export interface WorkspaceAdapter {
  type: WorkspaceType;
  capabilities: AdapterCapabilities;

  // Core operations
  readFile(path: string): Promise<FileData>;
  writeFile(path: string, content: string, version?: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(directory: string): Promise<FileMetadata[]>;

  // Optional operations
  renameFile?(oldPath: string, newPath: string): Promise<void>;
  createFolder?(path: string): Promise<void>;
  getFileVersion?(path: string): Promise<string | undefined>;
  getMetadata?(path: string): Promise<FileMetadata>;

  // Batch operations (future)
  batchWrite?(operations: BatchOperation[]): Promise<BatchResult>;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
}

export interface BatchResult {
  success: string[];
  failed: Array<{ path: string; error: string }>;
}

export interface WorkspaceConfig {
  type: WorkspaceType;
  metadata?: {
    folderId?: string; // for Google Drive
    bucket?: string; // for S3
    repo?: string; // for GitHub
    [key: string]: any;
  };
}

// Error types
export enum FileErrorType {
  NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONFLICT = 'FILE_CONFLICT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ADAPTER_ERROR = 'ADAPTER_ERROR',
  INVALID_PATH = 'INVALID_PATH',
  TIMEOUT = 'TIMEOUT',
}

export class FileSystemError extends Error {
  constructor(
    public type: FileErrorType,
    public path: string,
    message: string,
    public retryable = false,
    public metadata?: any
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}
```

---

## Adapter Implementations

### Local Adapter V2

**Location:** `src/core/file-manager-v2/adapters/local-adapter.ts`

```typescript
import { WorkspaceAdapter, WorkspaceType, FileData, FileMetadata, AdapterCapabilities, FileSystemError, FileErrorType } from '../types';

export class LocalAdapterV2 implements WorkspaceAdapter {
  type = WorkspaceType.LOCAL;
  
  capabilities: AdapterCapabilities = {
    supportsWatch: true,
    supportsBatch: false,
    supportsVersioning: true,
    supportsRename: true,
    supportsDirectories: false,
    maxFileSize: 100 * 1024 * 1024, // 100MB
  };

  private fileHandles = new Map<string, FileSystemFileHandle>();

  async readFile(path: string): Promise<FileData> {
    const handle = this.fileHandles.get(path);
    
    if (!handle) {
      throw new FileSystemError(
        FileErrorType.NOT_FOUND,
        path,
        `No file handle for: ${path}`,
        false
      );
    }

    try {
      const file = await handle.getFile();
      const content = await file.text();

      return {
        id: `local-${file.name}-${file.lastModified}`,
        path,
        name: file.name,
        category: 'local',
        content,
        size: file.size,
        lastModified: new Date(file.lastModified),
        version: file.lastModified.toString(),
        mimeType: file.type,
      };
    } catch (error) {
      throw new FileSystemError(
        FileErrorType.ADAPTER_ERROR,
        path,
        `Failed to read file: ${error}`,
        true
      );
    }
  }

  async writeFile(path: string, content: string, version?: string): Promise<void> {
    const handle = this.fileHandles.get(path);
    
    if (!handle) {
      throw new FileSystemError(
        FileErrorType.NOT_FOUND,
        path,
        `No file handle for: ${path}`,
        false
      );
    }

    // Optional: Check version for conflict detection
    if (version && this.capabilities.supportsVersioning) {
      const currentVersion = await this.getFileVersion(path);
      if (currentVersion && currentVersion !== version) {
        throw new FileSystemError(
          FileErrorType.CONFLICT,
          path,
          'File was modified externally',
          false,
          { expectedVersion: version, actualVersion: currentVersion }
        );
      }
    }

    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (error) {
      throw new FileSystemError(
        FileErrorType.ADAPTER_ERROR,
        path,
        `Failed to write file: ${error}`,
        true
      );
    }
  }

  async deleteFile(path: string): Promise<void> {
    this.fileHandles.delete(path);
  }

  async listFiles(directory: string): Promise<FileMetadata[]> {
    // Local adapter doesn't support directory listing
    return [];
  }

  async getFileVersion(path: string): Promise<string | undefined> {
    const handle = this.fileHandles.get(path);
    if (!handle) return undefined;

    try {
      const file = await handle.getFile();
      return file.lastModified.toString();
    } catch {
      return undefined;
    }
  }

  // Helper methods
  registerFileHandle(path: string, handle: FileSystemFileHandle): void {
    this.fileHandles.set(path, handle);
  }

  getFileHandle(path: string): FileSystemFileHandle | undefined {
    return this.fileHandles.get(path);
  }
}
```

### Demo Adapter V2

**Location:** `src/core/file-manager-v2/adapters/demo-adapter.ts`

```typescript
import { WorkspaceAdapter, WorkspaceType, FileData, FileMetadata, AdapterCapabilities } from '../types';

interface StoredFile {
  id: string;
  path: string;
  name: string;
  content: string;
  version: string;
  lastModified: string;
}

const STORAGE_KEY = 'verve_demo_files_v2';

export class DemoAdapterV2 implements WorkspaceAdapter {
  type = WorkspaceType.DEMO;
  
  capabilities: AdapterCapabilities = {
    supportsWatch: false,
    supportsBatch: true,
    supportsVersioning: false,
    supportsRename: true,
    supportsDirectories: true,
    maxFileSize: 5 * 1024 * 1024, // 5MB (localStorage limit)
  };

  private files = new Map<string, StoredFile>();
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  async readFile(path: string): Promise<FileData> {
    await this.ensureInitialized();
    
    const file = this.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    return {
      ...file,
      lastModified: new Date(file.lastModified),
      category: this.getCategoryFromPath(path),
      mimeType: 'text/markdown',
    };
  }

  async writeFile(path: string, content: string): Promise<void> {
    const existing = this.files.get(path);
    const now = new Date().toISOString();

    const file: StoredFile = {
      id: existing?.id || `demo-${Date.now()}`,
      path,
      name: path.split('/').pop() || path,
      content,
      version: Date.now().toString(),
      lastModified: now,
    };

    this.files.set(path, file);
    this.saveToStorage();
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
    this.saveToStorage();
  }

  async listFiles(directory: string): Promise<FileMetadata[]> {
    await this.ensureInitialized();
    
    const files: FileMetadata[] = [];
    
    for (const [path, file] of this.files) {
      // Simple directory filtering
      const dir = path.substring(0, path.lastIndexOf('/')) || '/';
      if (dir === directory || directory === '/') {
        files.push({
          id: file.id,
          path,
          name: file.name,
          category: this.getCategoryFromPath(path),
          size: file.content.length,
          lastModified: new Date(file.lastModified),
          mimeType: 'text/markdown',
        });
      }
    }

    return files;
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const file = this.files.get(oldPath);
    if (!file) {
      throw new Error(`File not found: ${oldPath}`);
    }

    this.files.delete(oldPath);
    this.files.set(newPath, {
      ...file,
      path: newPath,
      name: newPath.split('/').pop() || newPath,
    });
    
    this.saveToStorage();
  }

  async createFolder(path: string): Promise<void> {
    // Demo adapter doesn't need explicit folder creation
    console.log(`[DemoAdapter] Folder created: ${path}`);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.loadSampleFiles();
      this.initialized = true;
    }
  }

  private async loadSampleFiles(): Promise<void> {
    // Load sample markdown files (same as current implementation)
    const samplePaths = [
      '/01-basic-formatting.md',
      '/02-lists-and-tasks.md',
      // ... etc
    ];

    for (const path of samplePaths) {
      if (!this.files.has(path)) {
        try {
          const response = await fetch(`/content${path}`);
          const content = await response.text();
          await this.writeFile(path, content);
        } catch (error) {
          console.error(`Failed to load sample: ${path}`, error);
        }
      }
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.files = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('[DemoAdapter] Failed to load from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.files);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[DemoAdapter] Failed to save to storage:', error);
    }
  }

  private getCategoryFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : 'root';
  }
}
```

---

## Integration with Stores

### Workspace Store Updates

**Location:** `src/core/store/workspace-store.ts`

```typescript
import { create } from 'zustand';
import { WorkspaceType, WorkspaceConfig } from '@/core/file-manager-v2/types';
import { FileManager } from '@/core/file-manager-v2/file-manager';
import { LocalAdapterV2 } from '@/core/file-manager-v2/adapters/local-adapter';
import { DemoAdapterV2 } from '@/core/file-manager-v2/adapters/demo-adapter';
import { GoogleDriveAdapterV2 } from '@/core/file-manager-v2/adapters/google-drive-adapter';

interface WorkspaceState {
  // Current workspace
  workspaceType: WorkspaceType;
  fileManager: FileManager | null;
  
  // Sync status
  syncStatus: 'idle' | 'syncing' | 'error';
  pendingOperations: number;
  lastSyncError: string | null;
  
  // Actions
  initializeWorkspace: (type: WorkspaceType, config?: WorkspaceConfig) => Promise<void>;
  switchWorkspace: (type: WorkspaceType, config?: WorkspaceConfig) => Promise<void>;
  updateSyncStatus: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaceType: WorkspaceType.DEMO,
  fileManager: null,
  syncStatus: 'idle',
  pendingOperations: 0,
  lastSyncError: null,

  initializeWorkspace: async (type, config) => {
    const adapter = createAdapter(type, config);
    const fileManager = new FileManager(adapter);
    
    set({
      workspaceType: type,
      fileManager,
    });

    // Start monitoring sync status
    fileManager.getSyncQueue().subscribe(status => {
      set({
        syncStatus: status.isProcessing ? 'syncing' : 'idle',
        pendingOperations: status.pending + status.processing,
      });
    });
  },

  switchWorkspace: async (type, config) => {
    const { fileManager } = get();
    
    if (!fileManager) {
      await get().initializeWorkspace(type, config);
      return;
    }

    // Check for unsaved changes
    const status = fileManager.getSyncStatus();
    if (status.pendingOperations > 0) {
      // Show warning to user
      const confirmed = confirm(
        `You have ${status.pendingOperations} unsaved changes. Switch anyway?`
      );
      
      if (!confirmed) return;
    }

    // Switch adapter
    const adapter = createAdapter(type, config);
    await fileManager.switchAdapter(adapter);
    
    set({ workspaceType: type });
  },

  updateSyncStatus: () => {
    const { fileManager } = get();
    if (!fileManager) return;

    const status = fileManager.getSyncStatus();
    set({
      syncStatus: status.isProcessing ? 'syncing' : 'idle',
      pendingOperations: status.pendingOperations,
    });
  },
}));

function createAdapter(type: WorkspaceType, config?: WorkspaceConfig) {
  switch (type) {
    case WorkspaceType.LOCAL:
      return new LocalAdapterV2();
    
    case WorkspaceType.DEMO:
      return new DemoAdapterV2();
    
    case WorkspaceType.GOOGLE_DRIVE:
      return new GoogleDriveAdapterV2(config?.metadata?.folderId);
    
    default:
      throw new Error(`Unsupported workspace type: ${type}`);
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Implement FileManager core
- [ ] Implement FileCache with LRU eviction
- [ ] Implement SyncQueue with retry logic
- [ ] Define all TypeScript interfaces
- [ ] Unit tests for core components

### Phase 2: Adapters (Week 2-3)
- [ ] Refactor LocalAdapter to V2
- [ ] Refactor DemoAdapter to V2
- [ ] Refactor GoogleDriveAdapter to V2
- [ ] Add adapter capability detection
- [ ] Integration tests for adapters

### Phase 3: Store Integration (Week 3-4)
- [ ] Update WorkspaceStore to use FileManager V2
- [ ] Update EditorStore to use new APIs
- [ ] Update FileExplorerStore to use new APIs
- [ ] Add sync status indicators to UI
- [ ] E2E tests for user flows

### Phase 4: Migration & Cleanup (Week 4-5)
- [ ] Add feature flag for V2
- [ ] Migrate existing users gracefully
- [ ] Performance testing and optimization
- [ ] Remove old file manager code
- [ ] Documentation updates

### Phase 5: Polish & Future Features (Week 5-6)
- [ ] Add conflict resolution UI
- [ ] Implement change detection (pull-based sync)
- [ ] Add batch operations support
- [ ] Improve error handling and user feedback
- [ ] Performance monitoring

---

## Testing Strategy

### Unit Tests
```typescript
// file-manager.test.ts
describe('FileManager', () => {
  it('should load file from adapter', async () => {
    const adapter = new MockAdapter();
    const fm = new FileManager(adapter);
    
    const file = await fm.loadFile('/test.md');
    expect(file.content).toBe('test content');
  });

  it('should use cache on second load', async () => {
    const adapter = new MockAdapter();
    const fm = new FileManager(adapter);
    
    await fm.loadFile('/test.md');
    const spy = jest.spyOn(adapter, 'readFile');
    
    await fm.loadFile('/test.md');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should update file optimistically', async () => {
    const adapter = new MockAdapter();
    const fm = new FileManager(adapter);
    
    await fm.loadFile('/test.md');
    await fm.updateFile('/test.md', 'new content');
    
    const cached = fm.getCache().get('/test.md');
    expect(cached.content).toBe('new content');
    expect(cached.isDirty).toBe(true);
  });
});
```

### Integration Tests
```typescript
// workspace-flow.test.ts
describe('Workspace Flow', () => {
  it('should switch workspaces and clear cache', async () => {
    const store = useWorkspaceStore.getState();
    
    await store.initializeWorkspace(WorkspaceType.DEMO);
    await store.fileManager.loadFile('/demo.md');
    
    await store.switchWorkspace(WorkspaceType.LOCAL);
    
    expect(store.workspaceType).toBe(WorkspaceType.LOCAL);
    expect(store.fileManager.getCacheStats().size).toBe(0);
  });
});
```

---

## Performance Benchmarks

Target metrics:
- File load (cache hit): < 1ms
- File load (cache miss): < 100ms
- Optimistic update: < 5ms
- Sync to adapter: < 500ms (local), < 2s (Drive)
- Cache eviction: < 10ms
- Workspace switch: < 1s

---

## Security Checklist

- [ ] Validate all file paths (prevent directory traversal)
- [ ] Sanitize file content in UI (prevent XSS)
- [ ] Encrypt sensitive tokens in localStorage
- [ ] Implement CSP headers
- [ ] Rate limit API calls per adapter
- [ ] Validate file size before operations
- [ ] Secure OAuth flow for Drive adapter
- [ ] Audit all user inputs

---

## Future Considerations

### Pull-Based Sync
- Implement ChangeDetector service
- Add webhook support for Drive
- Polling fallback for adapters without webhooks
- Conflict resolution UI

### Collaboration
- WebSocket connection for real-time updates
- Operational Transform or CRDT for concurrent edits
- Presence indicators
- Cursor sharing

### Performance
- Web Worker for file parsing
- IndexedDB for larger cache
- Streaming for large files
- Service Worker for offline support

---

## Summary

This technical specification provides:
- Complete implementation details for all core components
- Concrete code examples and patterns
- Clear testing and migration strategy
- Performance and security guidelines
- Extensibility for future features

The architecture is designed for:
- Maintainability
- Testability
- Type safety
- Performance
- User experience

Ready for implementation with feature flag rollout.

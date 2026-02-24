/**
 * Sync queue with retry logic and debouncing
 */

import { WorkspaceAdapter, SyncOperation } from './types';
import { RETRY_CONFIG, STORAGE_KEYS } from './constants';

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

/**
 * Manages background synchronization with retry logic
 */
export class SyncQueue {
  private adapter: WorkspaceAdapter;
  private queue: SyncOperation[] = [];
  private processing = false;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private listeners = new Set<(status: QueueStatus) => void>();
  private fileCreatedCallbacks = new Set<(oldPath: string, newId: string) => void>();

  constructor(adapter: WorkspaceAdapter) {
    this.adapter = adapter;
    this.loadQueue();
  }

  /**
   * Add an operation to the queue
   */
  enqueue(operation: Omit<SyncOperation, 'id' | 'status' | 'retries'>): string {
    const existingTimer = this.debounceTimers.get(operation.path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const id = this.generateId(operation);
    const debounceMs = operation.debounceMs ?? 0;

    if (debounceMs > 0) {
      const timer = setTimeout(() => {
        this.addToQueue({ ...operation, id, status: 'pending', retries: 0 });
        this.debounceTimers.delete(operation.path);
      }, debounceMs);
      
      this.debounceTimers.set(operation.path, timer);
    } else {
      this.addToQueue({ ...operation, id, status: 'pending', retries: 0 });
    }

    return id;
  }

  /**
   * Process the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    this.notifyListeners();

    while (this.queue.length > 0) {
      const operation = this.queue.find(op => op.status === 'pending');
      if (!operation) break;

      operation.status = 'processing';
      this.saveQueue();
      this.notifyListeners();

      try {
        const newId = await this.executeOperation(operation);
        operation.status = 'completed';

        // If a new file ID was returned (Drive file creation), emit event to update cache
        if (newId && operation.type === 'create') {
          this.emitFileCreated(operation.path, newId);
        }
      } catch (error) {
        if (this.shouldRetry(operation, error)) {
          operation.status = 'pending';
          operation.retries++;
          const delay = this.calculateRetryDelay(operation.retries);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          operation.status = 'failed';
          operation.error = error instanceof Error ? error.message : String(error);
        }
      }

      this.saveQueue();
      this.notifyListeners();
    }

    this.processing = false;
    this.notifyListeners();

    // Check again for any new items
    setTimeout(() => this.processQueue(), 100);
  }

  /**
   * Execute a single operation via adapter
   * Returns new file ID if applicable (for Drive file creation)
   */
  private async executeOperation(operation: SyncOperation): Promise<string | void> {
    switch (operation.type) {
      case 'create':
      case 'update':
        return await this.adapter.writeFile(operation.path, operation.content!, operation.version);
      case 'delete':
        await this.adapter.deleteFile(operation.path);
        break;
      case 'rename':
        if (this.adapter.renameFile && operation.newPath) {
          await this.adapter.renameFile(operation.path, operation.newPath);
        }
        break;
      case 'create-folder':
        if (this.adapter.createFolder) {
          await this.adapter.createFolder(operation.path);
        }
        break;
    }
  }

  /**
   * Check if operation should be retried
   */
  private shouldRetry(operation: SyncOperation, error: unknown): boolean {
    if (operation.retries >= RETRY_CONFIG.maxRetries) return false;

    const errorStr = error instanceof Error ? error.message : String(error);
    const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'SERVER_ERROR'];
    
    return retryableErrors.some(err => errorStr.includes(err));
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retries: number): number {
    const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retries - 1);
    return Math.min(delay, RETRY_CONFIG.maxDelay);
  }

  /**
   * Wait for queue to become idle
   */
  async waitForIdle(timeoutMs = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.processing && this.queue.every(op => op.status !== 'pending')) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Timeout waiting for queue')), timeoutMs);
      
      const unsubscribe = this.subscribe(status => {
        if (!status.isProcessing && status.pending === 0) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  /**
   * Process operations for a specific path
   */
  async processByPath(path: string): Promise<void> {
    const operations = this.queue.filter(op => op.path === path && op.status === 'pending');
    for (const op of operations) {
      op.status = 'processing';
      try {
        await this.executeOperation(op);
        op.status = 'completed';
      } catch (error) {
        op.status = 'failed';
        op.error = error instanceof Error ? error.message : String(error);
      }
    }
    this.saveQueue();
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

    // Clear queue when adapter changes to prevent operations from wrong workspace
    this.queue = [];
    this.saveQueue();

    console.log('[SyncQueue] Adapter changed, queue cleared');
  }

  /**
   * Clear completed operations
   */
  clearCompleted(): void {
    this.queue = this.queue.filter(op => op.status !== 'completed');
    this.saveQueue();
  }

  /**
   * Subscribe to status changes
   */
  subscribe(listener: (status: QueueStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to file created events (when new ID is assigned)
   */
  onFileCreated(callback: (oldPath: string, newId: string) => void): () => void {
    this.fileCreatedCallbacks.add(callback);
    return () => this.fileCreatedCallbacks.delete(callback);
  }

  /**
   * Emit file created event
   */
  private emitFileCreated(oldPath: string, newId: string): void {
    this.fileCreatedCallbacks.forEach(callback => callback(oldPath, newId));
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.listeners.clear();
    this.fileCreatedCallbacks.clear();
    this.saveQueue();
  }

  /**
   * Add operation to queue and start processing
   */
  private addToQueue(operation: SyncOperation): void {
    this.removeDuplicates(operation.path, operation.type);
    this.queue.push(operation);
    this.saveQueue();
    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Remove duplicate operations for the same path
   */
  private removeDuplicates(path: string, type: SyncOperation['type']): void {
    this.queue = this.queue.filter(
      op => !(op.path === path && op.type === type && op.status === 'pending')
    );
  }

  /**
   * Generate unique operation ID
   */
  private generateId(operation: any): string {
    return `${operation.type}-${operation.path}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Load queue from storage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.syncQueue);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Reset processing status on load
        this.queue.forEach(op => {
          if (op.status === 'processing') op.status = 'pending';
        });
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  /**
   * Save queue to storage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.syncQueue, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }
}

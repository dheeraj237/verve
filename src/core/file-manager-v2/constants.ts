/**
 * Configuration constants for File Manager V2
 */

export const DEBOUNCE_CONFIG = {
  autoSave: 2000,
  userSave: 0,
  create: 100,
  delete: 0,
  rename: 0,
} as const;

export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
} as const;

export const CACHE_CONFIG = {
  maxSize: 100,
  maxMemory: 50 * 1024 * 1024, // 50MB
  ttl: 5 * 60 * 1000, // 5 minutes
} as const;

export const STORAGE_KEYS = {
  syncQueue: 'verve_sync_queue_v2',
  demoFiles: 'verve_demo_files_v2',
} as const;

import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';

import { cachedFileSchema, syncQueueSchema, migrationStrategies } from './schemas';
import type { CachedFile } from './types';

// Plugin registration for browser environment
// Use NODE_ENV for runtime checks to remain compatible with Jest/Node tests
if (process.env.NODE_ENV === 'development') {
  addRxPlugin(RxDBDevModePlugin);
}
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

/**
 * Safely convert an error to a serializable string, handling circular references
 */
function safeErrorToString(error: any): string {
  try {
    // Try to stringify first (for simple errors)
    return JSON.stringify(error);
  } catch {
    // If that fails, construct a string from error properties
    const parts: string[] = [];
    if (error?.message) parts.push(`Message: ${error.message}`);
    if (error?.code) parts.push(`Code: ${error.code}`);
    if (error?.name) parts.push(`Name: ${error.name}`);
    if (error?.stack) parts.push(`Stack: ${error.stack.substring(0, 200)}`);
    return parts.length > 0 ? parts.join(' | ') : String(error).substring(0, 200);
  }
}

export interface SyncQueueDoc {
  id: string;
  op: 'put' | 'delete';
  target: 'file';
  targetId: string;
  payload?: any;
  attempts?: number;
  createdAt?: number;
}

export interface CacheDatabase {
  cached_files: RxCollection<CachedFile>;
  sync_queue?: any;
  destroy(): Promise<boolean>;
  waitForLeadership(): Promise<boolean>;
  name: string;
}

let cachedDb: CacheDatabase | null = null;
let initInProgress = false;
let retryCount = 0;
const MAX_RETRIES = 2; // Prevent infinite loops

/**
 * Clear all IndexedDB databases to reset state
 */
async function clearAllIndexedDatabases(): Promise<void> {
  console.log('[RxDB] Clearing all IndexedDB databases...');

  try {
    // Get all databases (if available)
    if ('databases' in indexedDB) {
      const dbs = await indexedDB.databases();
      console.log('[RxDB] Found databases:', dbs.map(d => d.name).filter(Boolean));

      for (const dbInfo of dbs) {
        if (dbInfo.name) {
          console.log('[RxDB] Deleting database:', dbInfo.name);
          await new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(dbInfo.name!);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => console.warn(`[RxDB] Delete blocked for ${dbInfo.name}`);
          });
        }
      }
    }

    // Also explicitly delete the specific database
    console.log('[RxDB] Explicitly deleting verve_cache_db...');
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('verve_cache_db');
      request.onsuccess = () => {
        console.log('[RxDB] verve_cache_db deleted successfully');
        resolve();
      };
      request.onerror = () => {
        console.warn('[RxDB] Error deleting verve_cache_db');
        resolve();
      };
    });

    // Wait for full cleanup
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('[RxDB] All databases cleared');
  } catch (err) {
    console.warn('[RxDB] Error during database cleanup:', err);
  }
}

/**
 * Initialize RxDB with Dexie RxStorage for browser persistence.
 * 
 * Based on RxDB best practices for React applications (https://rxdb.info/articles/react-database.html):
 * - Uses Dexie RxStorage for efficient IndexedDB-based persistence
 * - Enables multiInstance: true for multi-tab synchronization
 * - Enables eventReduce: true for performance optimization with reactive queries
 * - Registers `cached_files` and `sync_queue` collections with defined schemas
 * 
 * Key features:
 * - Reactive data handling: Observable queries automatically update when data changes
 * - Local-first approach: Works offline with automatic sync when reconnected
 * - Multi-tab support: Data changes propagated across browser tabs
 * - Observable queries: Use .$ to subscribe to query results
 * 
 * @returns {Promise<CacheDatabase>} Initialized database instance
 * @throws {Error} If initialization fails after retries
 * 
 * @see https://rxdb.info/articles/react-database.html
 */
export async function initializeRxDB(): Promise<CacheDatabase> {
  if (cachedDb) {
    return cachedDb;
  }

  // Prevent multiple simultaneous initialization attempts
  if (initInProgress) {
    console.log('[RxDB] Initialization already in progress, waiting...');
    let attempts = 0;
    while (initInProgress && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (cachedDb) return cachedDb;
    }
    if (cachedDb) return cachedDb;
    throw new Error('RxDB initialization timeout');
  }

  initInProgress = true;

  try {
    console.log('[RxDB] Initializing RxDB database...');

    // Create database with recommended React best practices
    const db = await createRxDatabase<CacheDatabase>({
      name: 'verve_cache_db',
      storage: getRxStorageDexie(),               // Dexie-based IndexedDB storage
      multiInstance: true,                        // Enable multi-tab synchronization
      eventReduce: true,                          // Optimize performance for reactive queries
      ignoreDuplicate: true                       // Allow reusing database across tabs
    });

    console.log('[RxDB] Database created, registering collections...');

    // Register collections with their schemas and migration strategies
    const collections = {
      cached_files: {
        schema: cachedFileSchema,
        migrationStrategies: migrationStrategies.cachedFile
      },
      sync_queue: {
        schema: syncQueueSchema,
        migrationStrategies: migrationStrategies.syncQueue
      }
    };

    await db.addCollections(collections);

    console.log('[RxDB] Collections registered successfully');

    // Store database instance and reset retry count
    cachedDb = db;
    retryCount = 0;

    console.log('[RxDB] Database initialization complete');

    return db;
  } catch (error: any) {
    const safeErrorStr = safeErrorToString(error);
    console.error('[RxDB] Initialization failed:', {
      code: error?.code,
      message: error?.message,
      name: error?.name
    });

    // Handle fatal errors - don't retry
    if (error?.name === 'DatabaseClosedError' || error?.message?.includes('DatabaseClosedError')) {
      console.error('[RxDB] Fatal error: Database is closed');
      initInProgress = false;
      cachedDb = null;
      throw error;
    }

    // Detect incompatibility errors that warrant a full database reset
    const isDXE1Error = error?.code === 'DXE1' || safeErrorStr.includes('DXE1');
    const isDB1Error = error?.code === 'DB1' || safeErrorStr.includes('DB1');
    const isSchemaError = error?.code?.includes('SC34') ||
      error?.code?.includes('DB6') ||
      error?.code?.includes('DB5') ||
      error?.code?.includes('SC39') ||
      safeErrorStr.includes('SC34') ||
      safeErrorStr.includes('DB6') ||
      safeErrorStr.includes('schema') ||
      safeErrorStr.includes('previousSchema') ||
      safeErrorStr.includes('maxLength') ||
      safeErrorStr.includes('primary key') ||
      error?.message?.includes('schema') ||
      error?.message?.includes('DB6');

    // Retry on incompatibility errors with database reset
    if ((isDXE1Error || isDB1Error) && retryCount < MAX_RETRIES) {
      console.log(`[RxDB] Storage incompatibility detected (${retryCount + 1}/${MAX_RETRIES}). Clearing and retrying...`);
      try {
        cachedDb = null;
        retryCount++;
        await clearAllIndexedDatabases();

        initInProgress = false;
        return initializeRxDB();
      } catch (clearError) {
        console.error('[RxDB] Failed to recover from incompatibility error:', clearError);
        initInProgress = false;
        throw error;
      }
    }

    // Handle schema errors gracefully
    if (isSchemaError) {
      console.error('[RxDB] Schema error - clear browser storage and reload');
      initInProgress = false;
      cachedDb = null;
      throw new Error(`RxDB schema error: ${error?.message || 'Unknown'}. Clear storage and reload.`);
    }

    // Max retries exceeded
    if (retryCount >= MAX_RETRIES) {
      console.error(`[RxDB] Max retries (${MAX_RETRIES}) exceeded`);
      initInProgress = false;
      cachedDb = null;
      throw new Error(`RxDB initialization failed after ${MAX_RETRIES} attempts`);
    }

    initInProgress = false;
    throw error;
  } finally {
    if (initInProgress) {
      initInProgress = false;
    }
  }
}

/**
 * Get the initialized RxDB instance.
 * Throws if database has not been initialized.
 */
export function getCacheDB(): CacheDatabase {
  if (!cachedDb) {
    throw new Error('RxDB not initialized. Call initializeRxDB() first.');
  }
  return cachedDb;
}

/**
 * Close the RxDB instance and clean up resources.
 */
export async function closeCacheDB(): Promise<void> {
  if (cachedDb) {
    try {
      await cachedDb.destroy();
    } catch (error) {
      console.warn('[RxDB] Error during database destruction:', error);
    } finally {
      cachedDb = null;
      initInProgress = false;
      retryCount = 0;
    }
  }
}

/**
 * Check if RxDB is initialized.
 */
export function isCacheDBInitialized(): boolean {
  return cachedDb !== null;
}

/**
 * Add or update a cached file entry.
 */
export async function upsertCachedFile(file: CachedFile): Promise<void> {
  const db = getCacheDB();
  try {
    const existing = await db.cached_files.findOne({ selector: { id: file.id } }).exec();
    if (existing) {
      try {
        await existing.patch(file);
      } catch (err: any) {
        const errStr = String(err || '');
        if (errStr.includes('CONFLICT') || err?.status === 409) {
          console.warn('[RxDB] cached_files patch conflict detected, forcing overwrite for', file.id);
          try {
            await existing.remove();
          } catch (removeErr) {
            console.warn('[RxDB] Failed to remove conflicting cached_file, attempting insert anyway', removeErr);
          }
          try {
            await db.cached_files.insert(file);
          } catch (insertErr) {
            console.error('[RxDB] Forced insert of cached_file failed:', file.id, insertErr);
            throw insertErr;
          }
        } else {
          throw err;
        }
      }
    } else {
      await db.cached_files.insert(file);
    }
  } catch (error) {
    console.error('Failed to upsert cached file:', file.id, error);
    throw error;
  }
}

/**
 * Get a cached file by id or path.
 *
 * Many callers historically passed a file `path` instead of the internal `id`.
 * This helper first attempts to resolve by `id`, and if not found, falls back
 * to resolving by `path` so both lookup styles are supported.
 */
export async function getCachedFile(idOrPath: string, workspaceId?: string): Promise<CachedFile | null> {
  const db = getCacheDB();
  try {
    // Try to find by id first (most callers use id). If workspaceId is provided,
    // try scoped lookup first to prefer workspace-scoped entries.
    let doc = null;

    if (workspaceId) {
      doc = await db.cached_files.findOne({ selector: { id: idOrPath, workspaceId } }).exec();
      if (doc) return doc.toJSON();
    }

    doc = await db.cached_files.findOne({ selector: { id: idOrPath } }).exec();
    if (doc) return doc.toJSON();

    // Fallback: try to find by path (some modules pass the path)
    if (workspaceId) {
      doc = await db.cached_files.findOne({ selector: { path: idOrPath, workspaceId } }).exec();
      if (doc) return doc.toJSON();
    }

    doc = await db.cached_files.findOne({ selector: { path: idOrPath } }).exec();
    return doc ? doc.toJSON() : null;
  } catch (error) {
    console.error('Failed to get cached file (idOrPath=', idOrPath, '):', error);
    return null;
  }
}

/**
 * Remove a cached file by ID.
 */
export async function removeCachedFile(id: string): Promise<void> {
  const db = getCacheDB();
  try {
    const doc = await db.cached_files.findOne({ selector: { id } }).exec();
    if (doc) {
      await doc.remove();
    }
  } catch (error) {
    console.error('Failed to remove cached file:', id, error);
    throw error;
  }
}

/**
 * Get all cached files, optionally filtered by path prefix.
 */
export async function getAllCachedFiles(pathPrefix?: string): Promise<CachedFile[]> {
  const db = getCacheDB();
  try {
    const query = pathPrefix
      ? db.cached_files.find({ selector: { path: { $regex: `^${pathPrefix}` } } })
      : db.cached_files.find({});
    const docs = await query.exec();
    return docs.map((doc) => doc.toJSON());
  } catch (error) {
    console.error('Failed to get cached files:', error);
    return [];
  }
}
/**
 * Subscribe to changes in cached_files collection.
 */
export function observeCachedFiles(callback: (docs: CachedFile[]) => void) {
  const db = getCacheDB();
  return db.cached_files.find().$.subscribe((docs) => {
    callback(docs.map((doc) => doc.toJSON()));
  });
}

/**
 * Observe only `cached_files` collection. CRDT collection has been removed.
 */

/**
 * Get all dirty cached files (unsynced changes).
 */
export async function getDirtyCachedFiles(): Promise<CachedFile[]> {
  const db = getCacheDB();
  try {
    const docs = await db.cached_files.find({ selector: { dirty: true } }).exec();
    return docs.map((doc) => doc.toJSON());
  } catch (error) {
    console.error('Failed to get dirty cached files:', error);
    return [];
  }
}

/**
 * Mark a cached file as synced (clear dirty flag).
 */
export async function markCachedFileAsSynced(id: string): Promise<void> {
  const db = getCacheDB();
  try {
    const doc = await db.cached_files.findOne({ selector: { id } }).exec();
    if (doc) {
      await doc.patch({ dirty: false });
    }
  } catch (error) {
    console.error('Failed to mark cached file as synced:', id, error);
    throw error;
  }
}

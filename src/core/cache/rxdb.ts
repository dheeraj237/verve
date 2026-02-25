import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';

import { cachedFileSchema, crdtDocSchema, syncQueueSchema } from './schemas';
import type { CachedFile, CrdtDoc } from './types';

// Plugin registration for browser environment
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBJsonDumpPlugin);

export interface SyncQueueDoc {
  id: string;
  op: 'put' | 'delete';
  target: 'file' | 'crdt';
  targetId: string;
  payload?: any;
  attempts?: number;
  createdAt?: number;
}

export interface CacheDatabase {
  cached_files: RxCollection<CachedFile>;
  crdt_docs: RxCollection<CrdtDoc>;
  sync_queue?: any;
  destroy(): Promise<boolean>;
  waitForLeadership(): Promise<boolean>;
  name: string;
}

let cachedDb: CacheDatabase | null = null;

/**
 * Initialize RxDB with IndexedDB adapter for browser persistence.
 * Registers cached_files, crdt_docs, and optional sync_queue collections.
 */
export async function initializeRxDB(): Promise<CacheDatabase> {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const db = await createRxDatabase<CacheDatabase>({
      name: 'verve_cache_db',
      storage: getRxStorageDexie(),
      multiInstance: true, // Enable multi-tab support
      ignoreDuplicate: true // Ignore errors when reinitializing
    });

    // Register collections
    await db.addCollections({
      cached_files: {
        schema: cachedFileSchema
      },
      crdt_docs: {
        schema: crdtDocSchema
      },
      sync_queue: {
        schema: syncQueueSchema
      }
    });

    cachedDb = db;
    
    // Setup leader election for multi-tab coordination
    await db.waitForLeadership();

    return db;
  } catch (error) {
    console.error('Failed to initialize RxDB:', error);
    throw error;
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
    await cachedDb.destroy();
    cachedDb = null;
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
      await existing.patch(file);
    } else {
      await db.cached_files.insert(file);
    }
  } catch (error) {
    console.error('Failed to upsert cached file:', file.id, error);
    throw error;
  }
}

/**
 * Get a cached file by ID.
 */
export async function getCachedFile(id: string): Promise<CachedFile | null> {
  const db = getCacheDB();
  try {
    const doc = await db.cached_files.findOne({ selector: { id } }).exec();
    return doc ? doc.toJSON() : null;
  } catch (error) {
    console.error('Failed to get cached file:', id, error);
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
 * Add or update a CRDT doc entry.
 */
export async function upsertCrdtDoc(doc: CrdtDoc): Promise<void> {
  const db = getCacheDB();
  try {
    const existing = await db.crdt_docs.findOne({ selector: { id: doc.id } }).exec();
    if (existing) {
      await existing.patch(doc);
    } else {
      await db.crdt_docs.insert(doc);
    }
  } catch (error) {
    console.error('Failed to upsert CRDT doc:', doc.id, error);
    throw error;
  }
}

/**
 * Get a CRDT doc by ID.
 */
export async function getCrdtDoc(id: string): Promise<CrdtDoc | null> {
  const db = getCacheDB();
  try {
    const doc = await db.crdt_docs.findOne({ selector: { id } }).exec();
    return doc ? doc.toJSON() : null;
  } catch (error) {
    console.error('Failed to get CRDT doc:', id, error);
    return null;
  }
}

/**
 * Get a CRDT doc by file ID (foreign key).
 */
export async function getCrdtDocByFileId(fileId: string): Promise<CrdtDoc | null> {
  const db = getCacheDB();
  try {
    const doc = await db.crdt_docs.findOne({ selector: { fileId } }).exec();
    return doc ? doc.toJSON() : null;
  } catch (error) {
    console.error('Failed to get CRDT doc by file ID:', fileId, error);
    return null;
  }
}

/**
 * Remove a CRDT doc by ID.
 */
export async function removeCrdtDoc(id: string): Promise<void> {
  const db = getCacheDB();
  try {
    const doc = await db.crdt_docs.findOne({ selector: { id } }).exec();
    if (doc) {
      await doc.remove();
    }
  } catch (error) {
    console.error('Failed to remove CRDT doc:', id, error);
    throw error;
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
 * Subscribe to changes in crdt_docs collection.
 */
export function observeCrdtDocs(callback: (docs: CrdtDoc[]) => void) {
  const db = getCacheDB();
  return db.crdt_docs.find().$.subscribe((docs) => {
    callback(docs.map((doc) => doc.toJSON()));
  });
}

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

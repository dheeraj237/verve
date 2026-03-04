import { createRxDatabase, addRxPlugin } from 'rxdb';
import type { RxDatabase, RxCollection } from 'rxdb';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
// Use explicit storage plugins so tests can run with in-memory storage while
// browsers use Dexie-backed storage when available. Import the memory
// storage statically but load Dexie dynamically to avoid requiring ESM
// modules during Jest startup.
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { collections as schemaCollections } from './schemas';
import Collections from './collections';

let db: RxDatabase | null = null;

type AnyCollection = RxCollection<any> | any;


export async function createRxDB(): Promise<void> {
  // Ensure query builder plugin is available so `.where()` / `.sort()` etc work
  try { addRxPlugin(RxDBQueryBuilderPlugin); } catch (_) { }
  if (db) return;
  // Choose storage: force Dexie when requested (integration tests), or
  // prefer Dexie when `indexedDB` exists. Fallback to memory storage.
  let storage: any;
  const preferIdb = typeof indexedDB !== 'undefined';
  const forceDexie = process.env.FORCE_DEXIE === '1';
  if (forceDexie || preferIdb) {
    try {
      const mod: any = await import('rxdb/plugins/storage-dexie');
      const getRxStorageDexie = mod.getRxStorageDexie || (mod.default && mod.default.getRxStorageDexie);
      if (typeof getRxStorageDexie === 'function') {
        // Probe Dexie-backed storage to ensure it's usable in this environment.
        try {
          const probeName = `verve_probe_${process.env.JEST_WORKER_ID || '0'}_${Date.now()}`;
          const probeStorage = getRxStorageDexie();
          // Try creating and immediately removing a small DB to validate storage.
          const probeDb = await createRxDatabase({ name: probeName, storage: probeStorage, multiInstance: false, eventReduce: true });
          try { if ((probeDb as any).remove) await (probeDb as any).remove(); } catch (_) { }
          storage = getRxStorageDexie();
          console.info('[rxdb-client] storage=DEXIE');
        } catch (probeErr) {
          storage = getRxStorageMemory();
          console.info('[rxdb-client] storage=MEMORY (dexie probe failed)');
        }
      } else {
        storage = getRxStorageMemory();
        console.info('[rxdb-client] storage=MEMORY (no dexie factory)');
      }
    } catch (e) {
      storage = getRxStorageMemory();
      console.info('[rxdb-client] storage=MEMORY (dexie import failed)');
    }
  } else {
    storage = getRxStorageMemory();
  }

  try {
    // If an existing IDB named 'verve' exists, delete it first to avoid
    // duplicate-open errors when running tests in the same process.
    // If IndexedDB is available, try deleting any existing DB named 'verve'
    // to avoid duplicate-open errors when running tests in the same process.
    const dbName = process.env.JEST_WORKER_ID ? `verve_${process.env.JEST_WORKER_ID}` : 'verve';
    if (typeof indexedDB !== 'undefined' && typeof (indexedDB as any).deleteDatabase === 'function') {
      try {
        await new Promise<void>((resolve) => {
          try {
            const req = (indexedDB as any).deleteDatabase(dbName);
            if (!req) return resolve();
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          } catch (_) { resolve(); }
        });
      } catch (_) { /* ignore */ }
    }
    // Create a single database instance. Tests should either register
    // `fake-indexeddb/auto` in their Jest setup or mock this module.
    db = await createRxDatabase({ name: dbName, storage, multiInstance: false, eventReduce: true });

    await db.addCollections({
      [Collections.Workspaces]: { schema: (schemaCollections.workspaces as any).schema as any },
      [Collections.Files]: { schema: (schemaCollections.files as any).schema as any },
      [Collections.Settings]: { schema: (schemaCollections.settings as any).schema as any },
      [Collections.DirectoryHandlesMeta]: { schema: (schemaCollections.directory_handles_meta as any).schema as any },
      [Collections.SyncQueue]: { schema: (schemaCollections.sync_queue as any).schema as any }
    });
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to initialize RxDB: ${msg}. In tests register 'fake-indexeddb/auto' in Jest setup or mock '@/core/rxdb/rxdb-client'.`);
  }
}

// Useful for tests: destroy the database instance and remove underlying data.
export async function destroyRxDB(): Promise<void> {
  if (!db) return;
  try {
    // Attempt RxDB remove if available
    if (typeof (db as any).remove === 'function') {
      // rxdb remove may try to clear persisted storage
      await (db as any).remove();
    }
  } catch (_) { /* ignore */ }
  db = null;
}

export async function resetRxDB(): Promise<void> {
  await destroyRxDB();
  await createRxDB();
}

function ensureDb(): RxDatabase {
  if (!db) throw new Error('RxDB not initialized. Call createRxDB() first.');
  return db as RxDatabase;
}

export function getCollection<T = any>(name: Collections): AnyCollection {
  const database = ensureDb();
  const col = (database.collections as any)[name] as AnyCollection | undefined;
  if (!col) throw new Error(`Collection ${name} not found; did you call createRxDB()?`);
  return col as AnyCollection;
}

export async function upsertDoc<T extends { id: string }>(collection: Collections, doc: T): Promise<void> {
  const col = getCollection<T>(collection);
  try { console.log('[rxdb-client] upsertDoc', collection, (doc && (doc as any).id)); } catch (_) { }
  await col.upsert(doc as any);
}

export async function getDoc<T>(collection: Collections, id: string): Promise<T | null> {
  const col = getCollection<T>(collection);
  const doc = await col.findOne(id).exec();
  if (!doc) return null;
  return doc.toJSON() as T;
}

export async function findDocs<T>(collection: Collections, query: { selector?: any; sort?: any; limit?: number } = {}): Promise<T[]> {
  const col = getCollection<T>(collection);
  const rxQuery: any = col.find(query.selector || {});
  if (query.sort && typeof rxQuery.sort === 'function') rxQuery.sort(query.sort);
  if (typeof query.limit === 'number' && typeof rxQuery.limit === 'function') rxQuery.limit(query.limit);
  const docs = await rxQuery.exec();
  try { console.log('[rxdb-client] findDocs', collection, (query && query.selector)); } catch (_) { }
  return docs.map((d: any) => d.toJSON() as T);
}

export function subscribeDoc<T>(collection: Collections, id: string, cb: (doc: T | null) => void): () => void {
  const col = getCollection<T>(collection);
  const sub = col.findOne(id).$.subscribe((doc: any) => {
    cb(doc ? (doc.toJSON() as T) : null);
  });
  return () => sub.unsubscribe();
}

export function subscribeQuery<T>(collection: Collections, query: { selector?: any }, cb: (docs: T[]) => void): () => void {
  const col = getCollection<T>(collection);
  const sub = col.find(query.selector || {}).$.subscribe((docs: any[]) => {
    cb(docs.map((d) => (d ? d.toJSON() : null)).filter(Boolean) as T[]);
  });
  return () => sub.unsubscribe();
}

export async function atomicUpsert<T extends { id: string }>(collection: Collections, id: string, mutator: (current?: T | null) => T): Promise<T> {
  const col = getCollection<T>(collection);
  const existing = await col.findOne(id).exec();
  const current = existing ? (existing.toJSON() as T) : null;
  const next = mutator(current || undefined);
  try { console.log('[rxdb-client] atomicUpsert', collection, id); } catch (_) { }
  await col.upsert(next as any);
  return next;
}

export async function bulkWrite<T extends { id: string }>(collection: Collections, docs: Array<T>): Promise<void> {
  const col = getCollection<T>(collection);
  if (typeof col.bulkWrite === 'function') {
    const ops = docs.map((d) => ({ document: d }));
    await col.bulkWrite(ops);
  } else {
    await Promise.all(docs.map((d) => upsertDoc(collection, d)));
  }
}

export async function removeDoc(collection: Collections, id: string): Promise<void> {
  const col = getCollection(collection);
  const doc = await col.findOne(id).exec();
  if (doc) {
    await doc.remove();
  }
}

export function observeCollectionChanges(collection: Collections, handler: (change: any) => void): () => void {
  const col = getCollection(collection);
  const sub = col.$.subscribe((ev: any) => handler(ev));
  return () => sub.unsubscribe();
}

export function getCacheDB(): any {
  // Return the real RxDB collections so callers can use native query APIs.
  return {
    cached_files: getCollection(Collections.Files),
    sync_queue: getCollection(Collections.SyncQueue)
  } as any;
}

export async function initializeRxDB(): Promise<void> {
  await createRxDB();
}

export function subscribeToDoc<T>(collection: Collections, id: string, cb: (doc: T | null) => void): () => void {
  return subscribeDoc<T>(collection, id, cb);
}

export function subscribeToCollection<T>(collection: Collections, cb: (docs: T[]) => void): () => void {
  return subscribeQuery<T>(collection, {}, cb as any);
}

// Note: file-related helpers live in `src/core/cache/file-manager.ts`.
// Do NOT re-export them here to avoid circular imports. Import those
// helpers directly from the cache layer where needed.

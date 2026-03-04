import { createRxDatabase, addRxPlugin } from 'rxdb';
import type { RxDatabase, RxCollection } from 'rxdb';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
// Register the QueryBuilder plugin at module load so `.where()` / `.sort()`
// chain methods are available before any DB/queries are created.
try { addRxPlugin(RxDBQueryBuilderPlugin); } catch (_) { }
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { collections as schemaCollections } from './schemas';
import Collections from './collections';

let db: RxDatabase | null = null;
let initPromise: Promise<void> | null = null;

type AnyCollection = RxCollection<any> | any;


export async function createRxDB(): Promise<void> {
  if (db) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Prefer Dexie when available (and when `indexedDB` exists), but
    // fall back to memory storage for tests so we can iterate on schema
    // and query fixes without failing test environment initialization.
    let storage: any;
    try {
      const mod: any = await import('rxdb/plugins/storage-dexie');
      const getRxStorageDexie = mod.getRxStorageDexie || (mod.default && mod.default.getRxStorageDexie);
      if (typeof getRxStorageDexie === 'function' && typeof indexedDB !== 'undefined') {
        storage = getRxStorageDexie();
        console.info('[rxdb-client] storage=DEXIE');
      } else {
        storage = getRxStorageMemory();
        console.info('[rxdb-client] storage=MEMORY (dexie unavailable or no indexedDB)');
      }
    } catch (err) {
      storage = getRxStorageMemory();
      console.info('[rxdb-client] storage=MEMORY (dexie import failed)');
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
    // Create a single database instance using Dexie-backed storage.
    db = await createRxDatabase({ name: dbName, storage, multiInstance: false, eventReduce: true });

    await db.addCollections({
      [Collections.Workspaces]: { schema: (schemaCollections.workspaces as any).schema as any, migrationStrategies: {} },
      [Collections.Files]: { schema: (schemaCollections.files as any).schema as any, migrationStrategies: {} },
      [Collections.Settings]: { schema: (schemaCollections.settings as any).schema as any, migrationStrategies: {} },
      [Collections.DirectoryHandlesMeta]: { schema: (schemaCollections.directory_handles_meta as any).schema as any, migrationStrategies: {} },
      [Collections.SyncQueue]: { schema: (schemaCollections.sync_queue as any).schema as any, migrationStrategies: {} }
    });
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to initialize RxDB: ${msg}. In tests register 'fake-indexeddb/auto' in Jest setup or mock '@/core/rxdb/rxdb-client'.`);
  }
  })().finally(() => { initPromise = null; });
  return initPromise;
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
  try {
    const database = ensureDb();
    console.log('[rxdb-client] upsertDoc', collection, 'db=', (database as any).name, 'time=', Date.now(), 'id=', (doc && (doc as any).id));
  } catch (_) { }
  await col.upsert(doc as any);
}

export async function getDoc<T>(collection: Collections, id: string): Promise<T | null> {
  const col = getCollection<T>(collection);
  try {
    const database = ensureDb();
    console.log('[rxdb-client] getDoc', collection, 'db=', (database as any).name, 'time=', Date.now(), 'id=', id);
  } catch (_) { }
  const doc = await col.findOne(id).exec();
  if (!doc) {
    try { console.log('[rxdb-client] getDoc MISS', collection, 'id=', id); } catch (_) { }
    return null;
  }
  try { console.log('[rxdb-client] getDoc HIT', collection, 'id=', id); } catch (_) { }
  return doc.toJSON() as T;
}

export async function findDocs<T>(collection: Collections, query: { selector?: any; sort?: any; limit?: number } = {}): Promise<T[]> {
  const col = getCollection<T>(collection);
  const rxQuery: any = col.find({ selector: query.selector || {} });
  if (query.sort && typeof rxQuery.sort === 'function') rxQuery.sort(query.sort);
  if (typeof query.limit === 'number' && typeof rxQuery.limit === 'function') rxQuery.limit(query.limit);
  const docs = await rxQuery.exec();
  try {
    const database = ensureDb();
    console.log('[rxdb-client] findDocs', collection, 'db=', (database as any).name, 'time=', Date.now(), 'selector=', JSON.stringify(query.selector || {}), 'count=', (docs && docs.length));
  } catch (_) { }
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
  const sub = col.find({ selector: query.selector || {} }).$.subscribe((docs: any[]) => {
    cb(docs.map((d) => (d ? d.toJSON() : null)).filter(Boolean) as T[]);
  });
  return () => sub.unsubscribe();
}

export async function atomicUpsert<T extends { id: string }>(collection: Collections, id: string, mutator: (current?: T | null) => T): Promise<T> {
  const col = getCollection<T>(collection);
  try {
    const database = ensureDb();
    console.log('[rxdb-client] atomicUpsert START', collection, 'db=', (database as any).name, 'time=', Date.now(), 'id=', id);
  } catch (_) { }
  const existing = await col.findOne(id).exec();
  const current = existing ? (existing.toJSON() as T) : null;
  const next = mutator(current || undefined);
  await col.upsert(next as any);
  try {
    const database = ensureDb();
    console.log('[rxdb-client] atomicUpsert END', collection, 'db=', (database as any).name, 'time=', Date.now(), 'id=', id);
  } catch (_) { }
  return next;
}

export async function bulkWrite<T extends { id: string }>(collection: Collections, docs: Array<T>): Promise<void> {
  const col = getCollection<T>(collection);
  if (typeof col.bulkWrite === 'function') {
    const ops = docs.map((d) => ({ document: d }));
    try { const database = ensureDb(); console.log('[rxdb-client] bulkWrite', collection, 'db=', (database as any).name, 'time=', Date.now(), 'count=', ops.length); } catch (_) { }
    await col.bulkWrite(ops);
  } else {
    await Promise.all(docs.map((d) => upsertDoc(collection, d)));
  }
}

export async function removeDoc(collection: Collections, id: string): Promise<void> {
  const col = getCollection(collection);
  try { const database = ensureDb(); console.log('[rxdb-client] removeDoc', collection, 'db=', (database as any).name, 'time=', Date.now(), 'id=', id); } catch (_) { }
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

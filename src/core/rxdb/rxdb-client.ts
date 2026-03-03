import { createRxDatabase } from 'rxdb';
import type { RxDatabase, RxCollection } from 'rxdb';
import { collections as schemaCollections } from './schemas';
import Collections from './collections';

let db: RxDatabase | null = null;

type AnyCollection = RxCollection<any> | any;

export async function createRxDB(): Promise<void> {
  if (db) return;

  const preferIdb = typeof indexedDB !== 'undefined';

  // keep adapter selection as a constant
  const adapter = preferIdb ? 'idb' : 'memory';
  // Try to create an actual RxDB instance; if adapters/plugins are missing
  // (common in test envs), fall back to a small in-memory shim compatible
  // with the minimal surface area used by the app.
  try {
    // @ts-ignore
    db = await createRxDatabase({ name: 'verve', adapter, multiInstance: false, eventReduce: true });

    // add collections using centralized names
    await db.addCollections({
      [Collections.Workspaces]: { schema: (schemaCollections.workspaces as any).schema as any },
      [Collections.Files]: { schema: (schemaCollections.files as any).schema as any },
      [Collections.Settings]: { schema: (schemaCollections.settings as any).schema as any },
      [Collections.DirectoryHandlesMeta]: { schema: (schemaCollections.directory_handles_meta as any).schema as any },
      [Collections.SyncQueue]: { schema: (schemaCollections.sync_queue as any).schema as any }
    });
    return;
  } catch (err) {
    // fall back to in-memory shim for tests / environments lacking adapters
  }

  // In-memory shim implementation (minimal subset used by wrapper)
  const inMemoryDb: any = { collections: {} };

  const createCollection = (name: string) => {
    const docs = new Map<string, any>();
    const listeners = new Set<Function>();
    const docListeners = new Map<string, Set<Function>>();

    const emitCollection = () => {
      const arr = Array.from(docs.values()).map((d) => ({ toJSON: () => ({ ...d }) }));
      listeners.forEach((fn) => fn(arr));
    };

    const emitDoc = (id: string) => {
      const set = docListeners.get(id);
      const doc = docs.get(id);
      if (set) {
        set.forEach((fn) => fn(doc ? { toJSON: () => ({ ...doc }) } : null));
      }
    };

    return {
      upsert: async (doc: any) => {
        docs.set(doc.id, { ...doc });
        emitCollection();
        emitDoc(doc.id);
      },
      findOne: (id: string) => ({
        exec: async () => {
          const d = docs.get(id);
          return d ? { toJSON: () => ({ ...d }), remove: async () => { docs.delete(id); emitCollection(); emitDoc(id); } } : null;
        },
        $: {
          subscribe: (cb: Function) => {
            let set = docListeners.get(id);
            if (!set) { set = new Set(); docListeners.set(id, set); }
            set.add(cb);
            cb(docs.get(id) ? { toJSON: () => ({ ...docs.get(id) }) } : null);
            return { unsubscribe: () => { set!.delete(cb); } };
          }
        }
      }),
      find: (selector: any) => ({
        exec: async () => {
          const results = Array.from(docs.values()).filter((d) => {
            if (!selector) return true;
            return Object.keys(selector).every((k) => d[k] === selector[k]);
          }).map((d) => ({ toJSON: () => ({ ...d }) }));
          return results;
        },
        $: {
          subscribe: (cb: Function) => {
            listeners.add(cb);
            cb(Array.from(docs.values()).map((d) => ({ toJSON: () => ({ ...d }) })));
            return { unsubscribe: () => listeners.delete(cb) };
          }
        }
      }),
      bulkWrite: async (ops: any[]) => {
        for (const op of ops) {
          const doc = op.document || op;
          docs.set(doc.id, { ...doc });
          emitDoc(doc.id);
        }
        emitCollection();
      },
      $: {
        subscribe: (cb: Function) => {
          listeners.add(cb);
          cb(Array.from(docs.values()).map((d) => ({ toJSON: () => ({ ...d }) }))); 
          return { unsubscribe: () => listeners.delete(cb) };
        }
      }
    };
  };

  for (const key of Object.keys(schemaCollections)) {
    inMemoryDb.collections[key] = createCollection(key);
  }

  db = inMemoryDb;
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

// Basic CRUD + query helpers using enum collection names
export async function upsertDoc<T extends { id: string }>(collection: Collections, doc: T): Promise<void> {
  const col = getCollection<T>(collection);
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

// Provide a legacy-style `getCacheDB()` wrapper so existing code/tests can use
// `db.cached_files.find().where(...).eq(...).exec()` style calls.
export function getCacheDB(): any {
  const makeWrapper = (collectionName: any) => {
    const makeQuery = (selector: any = {}) => {
      let _selector = { ...(selector || {}) };
      let _sort: any = null;
      let _limit: number | null = null;

      const exec = async () => {
        await createRxDB();
        const col = getCollection(collectionName as any);
        let rxq: any = col.find(_selector || {});
        if (_sort && typeof rxq.sort === 'function') rxq = rxq.sort(_sort);
        const docs = await rxq.exec();
        let results = docs;
        if (_sort && typeof rxq.sort !== 'function') {
          const [[k, dir]] = Object.entries(_sort || {});
          results = results.sort((a: any, b: any) => {
            const va = (a.toJSON ? a.toJSON() : a)[k];
            const vb = (b.toJSON ? b.toJSON() : b)[k];
            if (va === vb) return 0;
            if (dir === 'asc') return va < vb ? -1 : 1;
            return va > vb ? -1 : 1;
          });
        }
        if (typeof _limit === 'number') results = results.slice(0, _limit);
        return results;
      };

      const subscribe = (cb: Function) => {
        let unsub = () => { };
        (async () => {
          await createRxDB();
          const col = getCollection(collectionName as any);
          const sub = col.find(_selector || {}).$.subscribe((docs: any) => cb(docs));
          unsub = () => sub.unsubscribe();
        })();
        return { unsubscribe: () => { try { unsub(); } catch (_) { } } };
      };

      const where = (field: string) => ({
        eq: (val: any) => {
          _selector = { ..._selector, [field]: val };
          return {
            exec,
            remove: async () => {
              const docs = await exec();
              for (const d of docs) {
                if (d && typeof d.remove === 'function') await d.remove();
              }
            },
            where,
            sort: (s: any) => { _sort = s; return (makeQuery(_selector) as any); },
            limit: (n: number) => { _limit = n; return (makeQuery(_selector) as any); }
          } as any;
        }
      });

      return {
        exec,
        $: { subscribe },
        where,
        sort: (s: any) => { _sort = s; return (makeQuery(_selector) as any); },
        limit: (n: number) => { _limit = n; return (makeQuery(_selector) as any); },
        remove: async () => {
          const docs = await exec();
          for (const d of docs) { if (d && typeof d.remove === 'function') await d.remove(); }
        }
      } as any;
    };

    return {
      find: (selector?: any) => makeQuery(selector),
      findOne: (arg: any) => ({
        exec: async () => {
          await createRxDB();
          const col = getCollection(collectionName as any);
          return await col.findOne(arg).exec();
        },
        $: {
          subscribe: (cb: Function) => {
            let unsub = () => { };
            (async () => {
              await createRxDB();
              const col = getCollection(collectionName as any);
              const sub = col.findOne(arg).$.subscribe((doc: any) => cb(doc));
              unsub = () => sub.unsubscribe();
            })();
            return { unsubscribe: () => { try { unsub(); } catch (_) { } } };
          }
        }
      }),
      upsert: async (doc: any) => {
        await createRxDB();
        const col = getCollection(collectionName as any);
        if (typeof col.upsert === 'function') return await col.upsert(doc);
        return upsertDoc(collectionName as any, doc as any);
      },
      remove: async (arg: any) => {
        await createRxDB();
        const col = getCollection(collectionName as any);
        if (arg) {
          const d = await col.findOne(arg).exec();
          if (d && typeof d.remove === 'function') await d.remove();
        } else {
          const docs = await col.find({}).exec();
          for (const d of docs) if (d && typeof d.remove === 'function') await d.remove();
        }
      }
    } as any;
  };

  return {
    cached_files: makeWrapper(Collections.Files),
    sync_queue: makeWrapper(Collections.SyncQueue),
  } as any;
}

// --- Compatibility: keep initialization here; file-specific helpers live in the
// cache/file-manager module (re-exported below for backwards compatibility).
export async function initializeRxDB(): Promise<void> {
  await createRxDB();
}

// Convenience wrappers for UI/store subscriptions
export function subscribeToDoc<T>(collection: Collections, id: string, cb: (doc: T | null) => void): () => void {
  return subscribeDoc<T>(collection, id, cb);
}

export function subscribeToCollection<T>(collection: Collections, cb: (docs: T[]) => void): () => void {
  return subscribeQuery<T>(collection, {}, cb as any);
}

// Re-export file-related helpers from the cache layer to preserve existing
// import locations. The implementations live in `src/core/cache/file-manager.ts`.
export {
  getCacheDB,
  closeCacheDB,
  upsertCachedFile,
  getCachedFile,
  getAllCachedFiles,
  observeCachedFiles,
  getDirtyCachedFiles,
  markCachedFileAsSynced,
  removeCachedFile
} from '@/core/cache/file-manager';

// Simple in-memory rxdb-client mock for tests. Implements minimal CRUD and
// query behavior so tests that save then read see consistent results. Also
// emits lightweight immediate "subscription" callbacks.

const store: Record<string, Map<string, any>> = {};

export async function createRxDB(): Promise<any> { return null; }
export async function initializeRxDB(): Promise<void> { return; }

function ensureCollection(name: string) {
  if (!store[name]) store[name] = new Map<string, any>();
  return store[name];
}

function matchSelector(obj: any, selector: any): boolean {
  if (!selector || Object.keys(selector).length === 0) return true;
  for (const k of Object.keys(selector)) {
    const v = selector[k];
    const val = obj && obj[k];
    if (v && typeof v === 'object' && v.$regex) {
      const re = new RegExp(v.$regex);
      if (!re.test(String(val || ''))) return false;
    } else if (val !== v) {
      return false;
    }
  }
  return true;
}

export const upsertDoc = async (collection: string, doc: any) => {
  try { console.log('[rxdb-client-mock] upsertDoc', collection, doc && doc.id); } catch (_) { }
  const col = ensureCollection(collection);
  if (!doc || !doc.id) return;
  col.set(String(doc.id), JSON.parse(JSON.stringify(doc)));
};

export const getDoc = async (collection: string, id: string) => {
  try { console.log('[rxdb-client-mock] getDoc', collection, id); } catch (_) { }
  const col = ensureCollection(collection);
  const v = col.get(String(id));
  return v ? JSON.parse(JSON.stringify(v)) : null;
};

export const findDocs = async (collection: string, opts: any = {}) => {
  const col = ensureCollection(collection);
  const arr = Array.from(col.values()).filter((d) => matchSelector(d, opts.selector || {}));
  try { console.log('[rxdb-client-mock] findDocs', collection, 'selector=', JSON.stringify(opts.selector || {}), 'count=', arr.length); } catch (_) { }
  return arr.map((d) => JSON.parse(JSON.stringify(d)));
};

export const subscribeDoc = (_col: any, id: any, cb: any) => {
  (async () => { cb(await getDoc(_col, id)); })();
  return { unsubscribe: () => { } };
};

export const subscribeQuery = (col: any, query: any, cb: any) => {
  (async () => { cb(await findDocs(col, query)); })();
  return { unsubscribe: () => { } };
};

export const atomicUpsert = async (collection: string, id: string, mutator: any) => {
  const current = await getDoc(collection, id);
  const next = await mutator(current || undefined);
  await upsertDoc(collection, next as any);
  return next;
};

export const bulkWrite = async (collection: string, docs: any[]) => {
  for (const d of docs) {
    if (d && d.document && d.document.id) await upsertDoc(collection, d.document);
  }
};

export const removeDoc = async (collection: string, id: string) => {
  const col = ensureCollection(collection);
  col.delete(String(id));
};

export const observeCollectionChanges = (_col: any, _opts: any) => ({ unsubscribe: () => {} });

export const getCacheDB = () => ({
  cached_files: {
    find: (opts: any = {}) => ({ exec: async () => await findDocs('files', opts) })
  }
});

export const subscribeToDoc = subscribeDoc;
export const subscribeToCollection = subscribeQuery;

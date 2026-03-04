// Lightweight mock implementation for unit tests. Exports simple async helpers
// and collection stubs. Tests may spyOn these functions as needed.

export async function createRxDB(): Promise<any> { return null; }
export async function initializeRxDB(): Promise<void> { return; }

function noopSub() { return { unsubscribe: () => {} }; }
function makeQuery() {
  const subs: any[] = [];
  let selector: any = {};
  let _limit: number | null = null;
  let _sort: any = null;

  const exec = async () => [] as any[];
  const $ = { subscribe: (_cb: any) => noopSub() };

  const where = (field: string) => ({
    eq: (val: any) => {
      selector = { ...selector, [field]: val };
      return queryObj;
    }
  });

  const sort = (s: any) => { _sort = s; return queryObj; };
  const limit = (n: number) => { _limit = n; return queryObj; };

  const queryObj: any = {
    exec,
    $,
    where,
    sort,
    limit,
    find: () => queryObj,
    findOne: () => ({ exec: async () => null, $: { subscribe: () => noopSub() } })
  };

  return queryObj;
}

function collectionStub() {
  return {
    find: () => makeQuery(),
    findOne: () => ({ exec: async () => null, $: { subscribe: () => noopSub() } }),
    upsert: async () => {},
    bulkWrite: async () => {},
    $: { subscribe: () => noopSub() }
  };
}

export const getCollection = (name: string) => collectionStub();
export const upsertDoc = async (..._args: any[]) => undefined;
export const getDoc = async (..._args: any[]) => null;
export const findDocs = async (..._args: any[]) => [];
export const subscribeDoc = (_col: any, _id: any, cb: any) => ({ unsubscribe: () => {} });
export const subscribeQuery = (_col: any, _query: any, cb: any) => ({ unsubscribe: () => {} });
export const atomicUpsert = async (_col: any, _id: any, mutator: any) => mutator(undefined);
export const bulkWrite = async (..._args: any[]) => undefined;
export const removeDoc = async (..._args: any[]) => undefined;
export const observeCollectionChanges = (_col: any, _opts: any) => ({ unsubscribe: () => {} });

export const getCacheDB = () => ({
  cached_files: {
    find: () => ({ exec: async () => [] })
  }
});

export const subscribeToDoc = () => ({ unsubscribe: () => {} });
export const subscribeToCollection = () => ({ unsubscribe: () => {} });

// Global mock for unit tests to replace the real RxDB client.
// Individual tests may override these mocks as needed.

// Use CommonJS style so Jest can consume it during setup.
const jestMock = (globalThis as any).jest;
if (jestMock && typeof jestMock.mock === 'function') {
  jestMock.mock('@/core/rxdb/rxdb-client', () => {
    const noopSub = () => ({ unsubscribe: () => {} });
    const makeQuery = () => ({ exec: async () => [], $: { subscribe: () => noopSub() }, find: () => makeQuery(), findOne: () => ({ exec: async () => null, $: { subscribe: () => noopSub() } }) });
    const collectionStub = () => ({
      find: () => makeQuery(),
      findOne: () => ({ exec: async () => null, $: { subscribe: () => noopSub() } }),
      upsert: jestMock.fn(),
      bulkWrite: jestMock.fn(),
      $: { subscribe: () => noopSub() }
    });

    return {
      __esModule: true,
      createRxDB: jestMock.fn(),
      initializeRxDB: jestMock.fn(),
      getCollection: jestMock.fn(collectionStub),
      upsertDoc: jestMock.fn(),
      getDoc: jestMock.fn(),
      findDocs: jestMock.fn(async () => []),
      subscribeDoc: jestMock.fn(),
      subscribeQuery: jestMock.fn(),
      atomicUpsert: jestMock.fn(async (_col: any, id: any, mutator: any) => {
        const current = undefined;
        return mutator(current);
      }),
      bulkWrite: jestMock.fn(),
      removeDoc: jestMock.fn(),
      observeCollectionChanges: jestMock.fn(),
      getCacheDB: jestMock.fn(() => ({
        cached_files: {
          find: () => ({ exec: async () => [] })
        }
      })),
      subscribeToDoc: jestMock.fn(),
      subscribeToCollection: jestMock.fn()
    };
  });
}

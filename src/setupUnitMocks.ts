// Global mock for unit tests to replace the real RxDB client.
// Individual tests may override these mocks as needed.

import { vi } from 'vitest';

// Mock the RxDB client with Vitest
vi.mock('@/core/rxdb/rxdb-client', () => {
  const noopSub = () => ({ unsubscribe: () => { } });
  const makeQuery = () => ({ exec: async () => [], $: { subscribe: () => noopSub() }, find: () => makeQuery(), findOne: () => ({ exec: async () => null, $: { subscribe: () => noopSub() } }) });
  const collectionStub = () => ({
    find: () => makeQuery(),
    findOne: () => ({ exec: async () => null, $: { subscribe: () => noopSub() } }),
    upsert: vi.fn(),
    bulkWrite: vi.fn(),
    $: { subscribe: () => noopSub() }
  });

  return {
    __esModule: true,
    createRxDB: vi.fn(),
    initializeRxDB: vi.fn(),
    getCollection: vi.fn(collectionStub),
    upsertDoc: vi.fn(),
    getDoc: vi.fn(),
    findDocs: vi.fn(async () => []),
    subscribeDoc: vi.fn(),
    subscribeQuery: vi.fn(),
    atomicUpsert: vi.fn(async (_col: any, id: any, mutator: any) => {
      const current = undefined;
      return mutator(current);
    }),
    bulkWrite: vi.fn(),
    removeDoc: vi.fn(),
    observeCollectionChanges: vi.fn(),
    getCacheDB: vi.fn(() => ({
      cached_files: {
        find: () => ({ exec: async () => [] })
      }
    })),
    subscribeToDoc: vi.fn(),
    subscribeToCollection: vi.fn()
  };
});

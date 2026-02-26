/**
 * Integration test: initialize an in-memory RxDB (fake-indexeddb + Dexie storage),
 * seed a cached file and a sync_queue entry, run the queue processor, and
 * verify adapter push was called and the queue entry removed and file marked synced.
 */
import 'fake-indexeddb/auto';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';

import { cachedFileSchema, syncQueueSchema } from '@/core/cache/schemas';
import { enqueueSyncEntry, processPendingQueueOnce } from '@/core/sync/sync-queue-processor';

// Ensure plugins registered similar to runtime
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

import type { ISyncAdapter } from '@/core/sync/adapter-types';

describe('queue processor integration', () => {
  let db: any;

  beforeAll(async () => {
    db = await createRxDatabase({
      name: 'test_verve_cache_db',
      storage: getRxStorageDexie(),
      multiInstance: false,
      eventReduce: false,
      ignoreDuplicate: true,
    });

    await db.addCollections({
      cached_files: { schema: cachedFileSchema },
      sync_queue: { schema: syncQueueSchema },
    });
  });

  afterAll(async () => {
    if (db) await db.destroy();
  });

  test('processes queue entry end-to-end', async () => {
    // Insert a cached file marked dirty
    const file = {
      id: 'int-file-1',
      name: 'int.md',
      path: '/int/int.md',
      type: 'file',
      workspaceType: 'gdrive',
      content: 'hello',
      metadata: { driveId: 'drive-int' },
      lastModified: Date.now(),
      dirty: true,
    };

    await db.cached_files.upsert(file);

    // Enqueue a sync entry
    await db.sync_queue.upsert({ id: 'qe-1', op: 'put', target: 'file', targetId: file.id, attempts: 0, createdAt: Date.now() });

    // Mock the cache/rxdb module functions used by the processor to point at our db
    jest.doMock('@/core/cache/rxdb', () => ({
      getCacheDB: () => db,
      getCachedFile: async (id: string) => {
        const doc = await db.cached_files.findOne({ selector: { id } }).exec();
        return doc ? doc.toJSON() : null;
      },
      markCachedFileAsSynced: async (id: string) => {
        const doc = await db.cached_files.findOne({ selector: { id } }).exec();
        if (doc) await doc.patch({ dirty: false });
      },
    }));

    // Import the processor module after mocking
    const { processPendingQueueOnce: proc } = await import('@/core/sync/sync-queue-processor');

    const calls: any[] = [];
    const mockAdapter: ISyncAdapter = {
      name: 'mock-int',
      push: async (f: any, content: string) => {
        calls.push({ f, content });
        return true;
      },
      pull: async () => null,
    } as any;

    const adapters = new Map<string, ISyncAdapter>([[mockAdapter.name, mockAdapter]]);

    // Process pending entries
    await proc(adapters as any, 3);

    // Adapter should have been called
    expect(calls.length).toBeGreaterThanOrEqual(1);

    // Queue should be empty
    const remaining = await db.sync_queue.find().exec();
    expect(remaining.length).toBe(0);

    // File should be marked not dirty
    const updated = await db.cached_files.findOne({ selector: { id: file.id } }).exec();
    expect(updated.toJSON().dirty).toBe(false);
  });
});

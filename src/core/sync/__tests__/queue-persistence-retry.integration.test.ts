/**
 * Integration test: verify sync_queue persistence and retry across processor runs.
 *
 * - enqueue an entry
 * - run processor with an adapter that fails => attempts increments
 * - run processor again with adapter that succeeds => entry removed and file marked synced
 */
import 'fake-indexeddb/auto';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';

import { cachedFileSchema, syncQueueSchema } from '@/core/cache/schemas';

// Ensure plugins similar to runtime
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

import type { ISyncAdapter } from '@/core/sync/adapter-types';

describe('sync queue persistence and retry integration', () => {
  let db: any;

  beforeAll(async () => {
    db = await createRxDatabase({
      name: 'test_verve_cache_db_retry',
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

  test('queue entry persists and is retried after restart', async () => {
    const file = {
      id: 'retry-file-1',
      name: 'retry.md',
      path: '/retry/retry.md',
      type: 'file',
      workspaceType: 'gdrive',
      content: 'initial',
      metadata: { driveId: 'drive-retry' },
      lastModified: Date.now(),
      dirty: true,
    };

    await db.cached_files.upsert(file);

    // Initial queue entry
    await db.sync_queue.upsert({ id: 'qretry-1', op: 'put', target: 'file', targetId: file.id, attempts: 0, createdAt: Date.now() });

    // Mock cache/rxdb helpers to point to our test db
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

    // Import processor after mocking
    const { processPendingQueueOnce } = await import('@/core/sync/sync-queue-processor');

    // Adapter that fails (push returns false)
    const failingAdapter: ISyncAdapter = {
      name: 'fail-adapter',
      push: async () => false,
      pull: async () => null,
    } as any;

    const adaptersFail = new Map<string, ISyncAdapter>([[failingAdapter.name, failingAdapter]]);

    // First run: should increment attempts to 1
    await processPendingQueueOnce(adaptersFail as any, 3);

    const docAfterFail = await db.sync_queue.findOne({ selector: { id: 'qretry-1' } }).exec();
    expect(docAfterFail).toBeTruthy();
    expect(docAfterFail.toJSON().attempts).toBeGreaterThanOrEqual(1);

    // Now simulate restart/recovery: adapter succeeds
    const successAdapter: ISyncAdapter = {
      name: 'success-adapter',
      push: async (_f: any, _content: string) => true,
      pull: async () => null,
    } as any;

    const adaptersSuccess = new Map<string, ISyncAdapter>([[successAdapter.name, successAdapter]]);

    // Second run: should process and remove the queue entry and mark file synced
    await processPendingQueueOnce(adaptersSuccess as any, 3);

    const remaining = await db.sync_queue.find().exec();
    expect(remaining.length).toBe(0);

    const updatedFile = await db.cached_files.findOne({ selector: { id: file.id } }).exec();
    expect(updatedFile.toJSON().dirty).toBe(false);
  });
});

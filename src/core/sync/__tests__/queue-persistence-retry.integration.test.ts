/**
 * Integration test: verify sync_queue persistence and retry across processor runs.
 *
 * - enqueue an entry
 * - run processor with an adapter that fails => attempts increments
 * - run processor again with adapter that succeeds => entry removed and file marked synced
 */
/**
 * Integration test: verify sync_queue persistence and retry across processor runs.
 *
 * - enqueue an entry
 * - run processor with an adapter that fails => attempts increments
 * - run processor again with adapter that succeeds => entry removed and file marked synced
 */
import 'fake-indexeddb/auto';
import { vi, describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';

import { syncQueueSchema } from '@/core/rxdb/schemas';
import { FileType, WorkspaceType, SyncOp } from '@/core/cache/types';

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

    // Ensure both `cached_files` and `sync_queue` collections exist for this
    // integration scenario (tests interact with `db.cached_files`). Use a
    // minimal schema for `cached_files` sufficient for upsert/find operations.
    const cachedFilesSchema = {
      title: 'cached_files (test)',
      version: 0,
      type: 'object',
      primaryKey: 'id',
      properties: { id: { type: 'string', maxLength: 1024 } },
      required: ['id']
    };

    await db.addCollections({
      cached_files: { schema: cachedFilesSchema as any },
      sync_queue: { schema: syncQueueSchema as any },
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
      type: FileType.File,
      workspaceType: WorkspaceType.GDrive,
      content: 'initial',
      metadata: { driveId: 'drive-retry' },
      lastModified: Date.now(),
      dirty: true,
    };

    await db.cached_files.upsert(file);

    // Initial queue entry
    await db.sync_queue.upsert({ id: 'qretry-1', op: SyncOp.Put, target: 'file', targetId: file.id, attempts: 0, createdAt: Date.now() });

    // Mock cache/rxdb helpers to point to our test db
    vi.doMock('@/core/cache/file-manager', () => ({
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
    };

    const adaptersFail = new Map<string, ISyncAdapter>([[failingAdapter.name, failingAdapter]]);

    // First run: should increment attempts to 1
    await processPendingQueueOnce(adaptersFail, 3);

    const docAfterFail = await db.sync_queue.findOne({ selector: { id: 'qretry-1' } }).exec();
    expect(docAfterFail).toBeTruthy();
    expect(docAfterFail.toJSON().attempts).toBeGreaterThanOrEqual(1);

    // Now simulate restart/recovery: adapter succeeds
    const successAdapter: ISyncAdapter = {
      name: 'success-adapter',
      push: async (_f: any, _content: string) => true,
      pull: async () => null,
    };

    const adaptersSuccess = new Map<string, ISyncAdapter>([[successAdapter.name, successAdapter]]);

    // Second run: should process and remove the queue entry and mark file synced
    await processPendingQueueOnce(adaptersSuccess, 3);

    const remaining = await db.sync_queue.find().exec();
    expect(remaining.length).toBe(0);

    const updatedFile = await db.cached_files.findOne({ selector: { id: file.id } }).exec();
    expect(updatedFile.toJSON().dirty).toBe(false);
  });
});

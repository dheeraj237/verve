import 'fake-indexeddb/auto';

import { initFileOps, destroyCacheDB } from '@/tests/helpers/test-utils';
import { SyncOp } from '@/core/cache/types';

describe('sync-queue-processor integration (real cache)', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initFileOps();
  });

  afterAll(async () => {
    await destroyCacheDB();
  });

  it('processes a Put entry and clears dirty flag using real RxDB', async () => {
    // Import cache and processor after RxDB initialized
    const { getCacheDB } = await import('@/core/cache/rxdb');
    const { enqueueSyncEntry, processPendingQueueOnce } = await import('@/core/sync/sync-queue-processor');

    const db = getCacheDB();

    // Insert a cached file marked dirty
    await db.cached_files.upsert({
      id: 'int-file-qp',
      name: 'qp.md',
      path: '/qp/qp.md',
      type: 'file',
      workspaceType: 'gdrive',
      workspaceId: 'ws-q',
      content: 'payload',
      lastModified: Date.now(),
      dirty: true,
    });

    // Enqueue sync entry
    await enqueueSyncEntry({ op: SyncOp.Put, target: 'file', targetId: 'int-file-qp' });

    const calls: any[] = [];
    const adapter = {
      name: 'local-int',
      push: async (_descriptor: any, content: string) => {
        calls.push(content);
        return true;
      },
      delete: async () => false,
    } as any;

    await processPendingQueueOnce(new Map([[adapter.name, adapter]]), 3);

    // Verify queue empty
    const remaining = await db.sync_queue.find().exec();
    expect(remaining.length).toBe(0);

    // Verify file marked not dirty
    const doc = await db.cached_files.findOne({ selector: { id: 'int-file-qp' } }).exec();
    expect(doc).toBeDefined();
    expect(doc?.toJSON().dirty).toBe(false);

    // Verify adapter was called with content
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]).toBe('payload');
  });
});
import 'fake-indexeddb/auto';
import { initializeRxDB, getCacheDB, closeCacheDB } from '@/core/cache/rxdb';
import { enqueueSyncEntry, processPendingQueueOnce } from '@/core/sync/sync-queue-processor';
import { GDriveMock } from '@/core/sync/mocks/gdrive-mock';
import { upsertCachedFile, getCachedFile } from '@/core/cache/rxdb';
import { SyncOp } from '@/core/cache/types';

describe('Queue processor integration', () => {
  beforeAll(async () => {
    await initializeRxDB();
  });

  afterAll(async () => {
    try {
      await closeCacheDB();
    } catch { }
  });

  test('saveFile enqueues and processor pushes to adapter and clears dirty', async () => {
    const db = getCacheDB();
    const adapter = new GDriveMock();

    // insert a cached file
    const file = { id: 'f1', name: 'f1.md', path: 'f1.md', type: 'file', workspaceType: 'gdrive', workspaceId: 'ws1', content: 'hello', lastModified: Date.now(), dirty: true } as any;
    await upsertCachedFile(file);

    // enqueue entry
    await enqueueSyncEntry({ op: SyncOp.Put, target: 'file', targetId: 'f1', payload: null });

    // process queue
    await processPendingQueueOnce(new Map([['gdrive', adapter]]));

    // adapter should have content
    const pulled = await adapter.pull('f1');
    expect(pulled).toBe('hello');

    // cached file should be marked not dirty
    const cached = await getCachedFile('f1', 'ws1');
    expect(cached?.dirty).toBe(false);
  });
});


import 'fake-indexeddb/auto';

import { initializeRxDB, getCacheDB, closeCacheDB } from '@/core/cache/rxdb';
import { enqueueSyncEntry, processPendingQueueOnce } from '@/core/sync/sync-queue-processor';
import { upsertCachedFile, getCachedFile } from '@/core/cache/rxdb';
import { deleteFile } from '@/core/cache/file-manager';
import { SyncOp } from '@/core/cache/types';

describe('Queue processor delete propagation (integration)', () => {
  beforeAll(async () => {
    await initializeRxDB();
  });

  afterAll(async () => {
    try {
      await closeCacheDB();
    } catch (_) {
      // ignore
    }
  });

  test('deleteFile enqueues delete and processor calls adapter.delete with path', async () => {
    const db = getCacheDB();

    // Insert a cached file for a non-browser workspace (local)
    const file = {
      id: 'del-int-1',
      name: 'to-delete.md',
      path: '/to-delete.md',
      type: 'file',
      workspaceType: 'local',
      workspaceId: 'ws-del',
      content: 'bye',
      lastModified: Date.now(),
      dirty: false,
    } as any;

    await upsertCachedFile(file);

    // Call deleteFile (this should remove cached entry and enqueue Delete payload)
    await deleteFile(file.path, file.workspaceId);

    // There should be a queue entry present
    const q = await db.sync_queue.find().exec();
    expect(q.length).toBeGreaterThanOrEqual(1);

    // Prepare adapter that captures delete target
    const called: any[] = [];
    const adapter = {
      name: 'local-mock',
      push: async () => false,
      delete: async (target: string) => {
        called.push(target);
        return true;
      },
    } as any;

    // Process queue once with our adapter map
    await processPendingQueueOnce(new Map([[adapter.name, adapter]]));

    // After processing, queue should be empty
    const remaining = await db.sync_queue.find().exec();
    expect(remaining.length).toBe(0);

    // Adapter delete should have been called with the original path
    expect(called.length).toBeGreaterThanOrEqual(1);
    expect(called[0]).toBe(file.path);
  });
});

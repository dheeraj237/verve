import 'fake-indexeddb/auto';

import { initializeRxDB, getCacheDB, closeCacheDB, upsertCachedFile, getCachedFile } from '@/core/cache/rxdb';
import { renameFile } from '@/core/cache/file-manager';
import { enqueueSyncEntry, processPendingQueueOnce } from '@/core/sync/sync-queue-processor';
import { SyncOp } from '@/core/cache/types';

describe('Queue processor rename propagation (integration)', () => {
  beforeAll(async () => {
    await initializeRxDB();
  });

  afterAll(async () => {
    try {
      await closeCacheDB();
    } catch (_) {}
  });

  test('renameFile updates cache and processor pushes updated entry', async () => {
    const db = getCacheDB();

    // Insert initial cached file
    const file = { id: 'r1', name: 'old.md', path: '/old.md', type: 'file', workspaceType: 'local', workspaceId: 'ws-r', content: 'a', lastModified: Date.now(), dirty: false } as any;
    await upsertCachedFile(file);

    // Rename
    await renameFile('/old.md', '/new.md', 'ws-r');

    // Get cached by id and ensure path updated and marked dirty
    const cached = await getCachedFile('r1', 'ws-r');
    expect(cached).toBeDefined();
    expect(cached?.path).toBe('/new.md');
    expect(cached?.dirty).toBe(true);

    // Enqueue Put for renamed file
    await enqueueSyncEntry({ op: SyncOp.Put, target: 'file', targetId: 'r1', payload: { path: '/new.md', workspaceType: 'local', workspaceId: 'ws-r' } });

    const calls: any[] = [];
    const adapter = {
      name: 'local-int-rename',
      push: async (_desc: any, content: string) => {
        calls.push(content);
        return true;
      },
      delete: async () => false,
    } as any;

    await processPendingQueueOnce(new Map([[adapter.name, adapter]]));

    const remaining = await db.sync_queue.find().exec();
    expect(remaining.length).toBe(0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]).toBe('a');
  });
});

import 'fake-indexeddb/auto';

import { initializeRxDB, getCacheDB, closeCacheDB } from '@/core/cache/rxdb';
import { saveFile } from '@/core/cache/file-manager';
import { enqueueSyncEntry, processPendingQueueOnce } from '@/core/sync/sync-queue-processor';
import { upsertCachedFile, getCachedFile } from '@/core/cache/rxdb';
import { SyncOp } from '@/core/cache/types';

describe('Queue processor create propagation (integration)', () => {
  beforeAll(async () => {
    await initializeRxDB();
  });

  afterAll(async () => {
    try {
      await closeCacheDB();
    } catch (_) {}
  });

  test('saveFile marks dirty and processor pushes to adapter via queue', async () => {
    const db = getCacheDB();

    // Save a new file in a non-browser workspace
    await saveFile('/new-file.md', 'hello world', 'local', undefined, 'ws-create');

    // Find cached file and ensure it's marked dirty
    const cached = await getCachedFile('/new-file.md', 'ws-create');
    expect(cached).toBeDefined();
    expect(cached?.dirty).toBe(true);

    // Enqueue Put entry for the file
    await enqueueSyncEntry({ op: SyncOp.Put, target: 'file', targetId: cached!.id, payload: { path: cached!.path, workspaceType: cached!.workspaceType, workspaceId: cached!.workspaceId } });

    const calls: any[] = [];
    const adapter = {
      name: 'local-int-create',
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
    expect(calls[0]).toBe('hello world');
  });
});

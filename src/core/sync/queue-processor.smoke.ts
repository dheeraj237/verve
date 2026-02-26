import { initializeRxDB, getCacheDB } from '@/core/cache/rxdb';
import { enqueueSyncEntry, processPendingQueueOnce } from '@/core/sync/sync-queue-processor';
import type { ISyncAdapter } from '@/core/sync/adapter-types';

async function run() {
  console.log('Initializing RxDB (smoke test)...');
  await initializeRxDB();
  const db = getCacheDB();

  // Insert a cached file
  const file = {
    id: 'smoke-file-1',
    name: 'smoke.md',
    path: '/smoke/smoke.md',
    type: 'file',
    workspaceType: 'gdrive',
    content: 'hello',
    metadata: { driveId: 'drive-smoke' },
    lastModified: Date.now(),
    dirty: true,
  } as any;

  await db.cached_files.upsert(file);

  // Enqueue a sync entry
  await enqueueSyncEntry({ op: 'put', target: 'file', targetId: file.id });

  // Create a mock adapter that records pushes
  const calls: any[] = [];
  const mockAdapter: ISyncAdapter = {
    name: 'mock',
    push: async (_file: any, _content: string) => {
      calls.push({ file: _file, content: _content });
      return true;
    },
    pull: async () => null,
    exists: async () => true,
    delete: async () => true,
  } as any;

  const adapters = new Map<string, ISyncAdapter>([[mockAdapter.name, mockAdapter]]);

  // Process queue
  await processPendingQueueOnce(adapters as any, 3);

  console.log('Mock adapter calls:', calls.length);
  if (calls.length === 0) throw new Error('Queue processor did not call adapter');

  console.log('Smoke test passed');
}

if (require && require.main === module) {
  run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Smoke test failed:', err);
    process.exit(1);
  });
}

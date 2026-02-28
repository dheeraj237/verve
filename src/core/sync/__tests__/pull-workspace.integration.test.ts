import 'fake-indexeddb/auto';

import { initFileOps, destroyCacheDB } from '@/tests/helpers/test-utils';
// Import SyncManager dynamically after initializing file operations to ensure
// the cache/rxdb module instance is the same and RxDB is initialized.
import { WorkspaceType } from '@/core/cache/types';

describe('SyncManager.pullWorkspace (integration)', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initFileOps();
  });

  afterAll(async () => {
    await destroyCacheDB();
  });

  it('uses adapter.pullWorkspace to upsert remote files into RxDB', async () => {
    const { SyncManager } = await import('@/core/sync/sync-manager');
    const manager = new SyncManager();

    const adapter = {
      name: 'gdrive',
      pullWorkspace: async (workspaceId: string) => {
        return [
          { fileId: 'remote1.md', content: 'one' },
          { fileId: 'remote2.md', content: 'two' },
        ];
      },
    } as any;

    manager.registerAdapter(adapter);

    const workspace = { id: 'ws-remote', type: WorkspaceType.GDrive, path: '/', createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() } as any;

    await manager.pullWorkspace(workspace);

    const { getCachedFile } = await import('@/core/cache/rxdb');
    const cached1 = await getCachedFile('remote1.md', 'ws-remote');
    const cached2 = await getCachedFile('remote2.md', 'ws-remote');

    expect(cached1).toBeTruthy();
    expect(cached1?.content).toBe('one');
    expect(cached2).toBeTruthy();
    expect(cached2?.content).toBe('two');
  });
});

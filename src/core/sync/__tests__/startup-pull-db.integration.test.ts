import 'fake-indexeddb/auto';
import { initializeFileOperations } from '@/core/cache/file-operations';
import { getCacheDB } from '@/core/cache/rxdb';
import { initializeSyncManager, stopSyncManager } from '@/core/sync/sync-manager';
import { useWorkspaceStore } from '@/core/store/workspace-store';

describe('Startup pull integration (DB upsert)', () => {
  let manager: any;

  beforeAll(async () => {
    jest.resetModules();
    // ensure RxDB initialized
    await initializeFileOperations();

    // set active workspace to a gdrive workspace
    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-int', name: 'WS', type: 'gdrive' }], activeWorkspaceId: 'ws-int' });
  });

  afterAll(async () => {
    try {
      if (manager && typeof manager.stop === 'function') manager.stop();
    } catch (_) {}
    try {
      stopSyncManager();
    } catch (_) {}
    try {
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
  });

  it('pulls workspace files and upserts into RxDB', async () => {
    const adapter = {
      name: 'gdrive',
      pullWorkspace: async (workspaceId: string) => {
        return [{ fileId: 's1', content: 'startup-content' }];
      },
      // provide no-op push/pull/delete/exists to satisfy SyncManager.start polling
      push: async (_file: any, _content: string) => true,
      pull: async (_id: string) => null,
      delete: async (_id: string) => true,
      exists: async (_id: string) => true,
    } as any;

    manager = await initializeSyncManager([adapter]);

    // Perform workspace pull using manager API
    const active = useWorkspaceStore.getState().activeWorkspace?.();
    await manager.pullWorkspace(active);

    const db = getCacheDB();
    const doc = await db.cached_files.findOne({ selector: { id: 's1' } }).exec();
    expect(doc).toBeTruthy();
    expect(doc.toJSON().content).toBe('startup-content');
  });
});

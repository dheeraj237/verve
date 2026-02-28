import 'fake-indexeddb/auto';
import { initFileOps, destroyCacheDB } from '@/tests/helpers/test-utils';
import { WorkspaceType } from '@/core/cache/types';

describe('SyncManager pull for active workspace only (integration)', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initFileOps();
  });

  afterAll(async () => {
    await destroyCacheDB();
  });

  it('calls adapter.pull when file belongs to the active workspace', async () => {
    const { SyncManager } = await import('@/core/sync/sync-manager');
    const manager = new SyncManager();

    const { upsertCachedFile } = await import('@/core/cache');
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');

    // Create cached file in RxDB
    await upsertCachedFile({ id: 'f1', name: 'f1.md', path: '/f1.md', type: 'file', workspaceType: WorkspaceType.GDrive, workspaceId: 'ws-active', content: 'local content', lastModified: Date.now(), dirty: true });

    // Set active workspace in store
    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-active', name: 'Active', type: WorkspaceType.GDrive, createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() }], activeWorkspaceId: 'ws-active' });

    const adapter = { name: 'gdrive', push: jest.fn().mockResolvedValue(true), pull: jest.fn().mockResolvedValue('remote') } as any;
    manager.registerAdapter(adapter);

    (manager as any).pullAfterPush = true;

    await manager.enqueueAndProcess('f1', '/f1.md', 'gdrive', 'ws-active');

    expect(adapter.pull).toHaveBeenCalledWith('f1');
  });

  it('does not call adapter.pull when file is from a different workspace', async () => {
    const { SyncManager } = await import('@/core/sync/sync-manager');
    const manager = new SyncManager();

    const { upsertCachedFile } = await import('@/core/cache');
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');

    await upsertCachedFile({ id: 'f2', name: 'f2.md', path: '/f2.md', type: 'file', workspaceType: WorkspaceType.GDrive, workspaceId: 'ws-other', content: 'local content', lastModified: Date.now(), dirty: true });

    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-active', name: 'Active', type: WorkspaceType.GDrive, createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() }], activeWorkspaceId: 'ws-active' });

    const adapter = { name: 'gdrive', push: jest.fn().mockResolvedValue(true), pull: jest.fn().mockResolvedValue('remote') } as any;
    manager.registerAdapter(adapter);

    (manager as any).pullAfterPush = true;

    await manager.enqueueAndProcess('f2', '/f2.md', 'gdrive', 'ws-other');

    expect(adapter.pull).not.toHaveBeenCalled();
  });
});

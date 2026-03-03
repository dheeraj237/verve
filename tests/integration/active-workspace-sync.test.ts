import { initializeRxDB, closeCacheDB, upsertCachedFile, getCachedFile } from '@/core/cache/file-manager';
import { getSyncManager } from '@/core/sync/sync-manager';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType } from '@/core/cache/types';

jest.setTimeout(10000);

describe('Integration: active workspace sync', () => {
  beforeEach(async () => {
    // Initialize a fresh in-memory RxDB
    try {
      await initializeRxDB();
    } catch (e) {
      // if already initialized, ignore
    }
    // reset workspace store
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
  });

  afterEach(async () => {
    try {
      getSyncManager().stop();
    } catch (e) {
      // ignore
    }
    try {
      await closeCacheDB();
    } catch (e) {
      // ignore
    }
  });

  it('pushes and marks cached file synced when added to active workspace', async () => {
    const db = await initializeRxDB();

    const manager = getSyncManager();

    const pushes: any[] = [];
    const adapter = {
      name: 'local',
      isReady: () => true,
      push: jest.fn(async (desc: any, content: string) => {
        pushes.push({ desc, content });
        return true;
      }),
    } as any;

    manager.registerAdapter(adapter);
    manager.start();

    const ws = { id: 'int-ws', name: 'Integration WS', type: WorkspaceType.Local } as any;
    useWorkspaceStore.setState({ workspaces: [ws], activeWorkspaceId: ws.id });

    const file = {
      id: 'int-file-1',
      path: 'notes/test.md',
      workspaceId: ws.id,
      workspaceType: WorkspaceType.Local,
      dirty: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    } as any;

    // Insert into RxDB cached_files
    await upsertCachedFile(file);

    // Trigger an explicit sync cycle to ensure processing in test environment
    await (manager as any).syncNow();

    expect(adapter.push).toHaveBeenCalled();

    const updated = await getCachedFile(file.id, ws.id);
    expect(updated).not.toBeNull();
    expect(updated?.dirty).toBe(false);
  });
});

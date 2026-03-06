import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initFileOps, destroyCacheDB, createWorkspace, startSyncManagerWithAdapter } from '@/tests/helpers/test-utils';
import { saveFile, getCachedFile, markCachedFileAsSynced } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';
import { useWorkspaceStore } from '@/core/store/workspace-store';

describe('Integration: dirty indicator and sync behavior', () => {
  beforeEach(async () => {
    await initFileOps();
    // reset workspace store
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
  });

  afterEach(async () => {
    try { await destroyCacheDB(); } catch (_) { }
  });

  it('marks file dirty immediately on modification and clears for browser via markCachedFileAsSynced', async () => {
    const wsId = 'ws-browser-test';
    await createWorkspace('Browser WS', WorkspaceType.Browser, wsId as any);

    // Create initial file without dirty flag
    const created = await saveFile('/test.md', 'initial', WorkspaceType.Browser, undefined, wsId, { markDirty: false });
    const cached1 = await getCachedFile('/test.md', wsId);
    expect(cached1).toBeTruthy();
    expect(cached1!.dirty).toBeFalsy();

    // Modify file: should become dirty immediately
    await saveFile('/test.md', 'modified', WorkspaceType.Browser, undefined, wsId);
    const cached2 = await getCachedFile('/test.md', wsId);
    expect(cached2).toBeTruthy();
    expect(cached2!.dirty).toBeTruthy();

    // Simulate dummy browser-side push by marking as synced
    await markCachedFileAsSynced(cached2!.id);
    const cached3 = await getCachedFile('/test.md', wsId);
    expect(cached3).toBeTruthy();
    expect(cached3!.dirty).toBeFalsy();
  });

  it('marks file dirty and sync manager + adapter clears dirty for local workspace', async () => {
    const wsId = 'ws-local-test';
    await createWorkspace('Local WS', WorkspaceType.Local, wsId as any);

    // Create initial file without dirty flag
    const created = await saveFile('/local.md', 'initial', WorkspaceType.Local, undefined, wsId, { markDirty: false });
    const cached1 = await getCachedFile('/local.md', wsId);
    expect(cached1).toBeTruthy();
    expect(cached1!.dirty).toBeFalsy();

    // Modify file -> becomes dirty
    await saveFile('/local.md', 'edited', WorkspaceType.Local, undefined, wsId);
    const cached2 = await getCachedFile('/local.md', wsId);
    expect(cached2).toBeTruthy();
    expect(cached2!.dirty).toBeTruthy();

    // Create a simple mock adapter that reports ready and succeeds on push
    const mockAdapter = {
      name: 'local',
      getState: () => 'ready',
      getError: () => null,
      getReadinessInfo: () => ({ state: 'ready' }),
      initialize: async () => { /* noop */ },
      destroy: async () => { /* noop */ },
      validateReady: () => true,
      addEventListener: () => { /* noop */ },
      removeEventListener: () => { /* noop */ },
      push: async () => true,
      pull: async () => null,
    } as any;

    const mgr = await startSyncManagerWithAdapter(mockAdapter);
    // bind adapter to workspace so SyncManager can find it (tests can set private maps)
    const { getSyncManager } = await import('@/core/sync/sync-manager');
    const syncMgr = getSyncManager();
    // register adapter instance for this workspace so pushDirtyFile can find it
    (syncMgr as any).adaptersByWorkspace.set(wsId, mockAdapter);

    // Trigger syncNow which should push dirty file and clear dirty flag
    await syncMgr.syncNow();

    const cached3 = await getCachedFile('/local.md', wsId);
    expect(cached3).toBeTruthy();
    expect(cached3!.dirty).toBeFalsy();
  });
});

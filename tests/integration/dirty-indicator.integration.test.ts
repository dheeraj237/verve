import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initFileOps, destroyCacheDB, createWorkspace } from '@/tests/helpers/test-utils';
import { saveFile, getCachedFile, markCachedFileAsSynced } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';
import { useWorkspaceStore } from '@/core/store/workspace-store';

describe('Integration: dirty indicator and sync behavior', () => {
  beforeEach(async () => {
    await initFileOps();
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
  });

  afterEach(async () => {
    try { await destroyCacheDB(); } catch (_) { }
  });

  it('marks file dirty immediately on modification and clears for browser via markCachedFileAsSynced', async () => {
    const wsId = 'ws-browser-test';
    await createWorkspace('Browser WS', WorkspaceType.Browser, wsId as any);

    await saveFile('/test.md', 'initial', WorkspaceType.Browser, undefined, wsId, { markDirty: false });
    const cached1 = await getCachedFile('/test.md', wsId);
    expect(cached1).toBeTruthy();
    expect(cached1!.dirty).toBeFalsy();

    await saveFile('/test.md', 'modified', WorkspaceType.Browser, undefined, wsId);
    const cached2 = await getCachedFile('/test.md', wsId);
    expect(cached2).toBeTruthy();
    expect(cached2!.dirty).toBeTruthy();

    await markCachedFileAsSynced(cached2!.id);
    const cached3 = await getCachedFile('/test.md', wsId);
    expect(cached3).toBeTruthy();
    expect(cached3!.dirty).toBeFalsy();
  });

  it('marks file dirty on save and markCachedFileAsSynced clears it for local workspace', async () => {
    const wsId = 'ws-local-test';
    await createWorkspace('Local WS', WorkspaceType.Local, wsId as any);

    await saveFile('/local.md', 'initial', WorkspaceType.Local, undefined, wsId, { markDirty: false });
    const cached1 = await getCachedFile('/local.md', wsId);
    expect(cached1).toBeTruthy();
    expect(cached1!.dirty).toBeFalsy();

    await saveFile('/local.md', 'edited', WorkspaceType.Local, undefined, wsId);
    const cached2 = await getCachedFile('/local.md', wsId);
    expect(cached2).toBeTruthy();
    expect(cached2!.dirty).toBeTruthy();

    // Simulate what SyncManager does after a successful push
    await markCachedFileAsSynced(cached2!.id);

    const cached3 = await getCachedFile('/local.md', wsId);
    expect(cached3).toBeTruthy();
    expect(cached3!.dirty).toBeFalsy();
  });
});

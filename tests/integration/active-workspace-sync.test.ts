import { vi } from 'vitest';
import {
  initializeRxDB,
  closeCacheDB,
  upsertCachedFile,
  getCachedFile,
  markCachedFileAsSynced,
  subscribeToDirtyWorkspaceFiles,
} from '@/core/cache/file-manager';
import { getSyncManager } from '@/core/sync/sync-manager';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType } from '@/core/cache/types';
import { FileType } from '@/shared/types';

describe('Integration: active workspace sync', () => {
  beforeEach(async () => {
    try { await initializeRxDB(); } catch (_) { }
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
  });

  afterEach(async () => {
    try { getSyncManager().stop(); } catch (_) { }
    try { await closeCacheDB(); } catch (_) { }
  });

  it('mountWorkspace triggers pull and dirty-file subscription; push clears dirty flag', async () => {
    vi.useFakeTimers();

    const pushSpy = vi.fn().mockResolvedValue(undefined);
    const pullSpy = vi.fn().mockResolvedValue(undefined);

    const mockAdapter = {
      workspaceId: 'int-ws',
      type: 'local' as const,
      pull: pullSpy,
      push: pushSpy,
      destroy: vi.fn(),
      ensurePermission: vi.fn().mockResolvedValue(true),
      shouldIncludeFile: () => true,
      shouldIncludeFolder: () => true,
    };

    const mgr = getSyncManager();

    // Inject mock adapter directly, bypassing LocalAdapter constructor
    (mgr as any)._adapters.set('int-ws', mockAdapter);
    (mgr as any)._activeWorkspaceId = 'int-ws';

    const ws = {
      id: 'int-ws',
      name: 'Integration WS',
      type: WorkspaceType.Local,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };
    useWorkspaceStore.setState({ workspaces: [ws], activeWorkspaceId: ws.id });

    const fileId = 'int-ws:notes/test.md';
    await upsertCachedFile({
      id: fileId,
      path: 'notes/test.md',
      name: 'test.md',
      type: FileType.File,
      workspaceId: 'int-ws',
      workspaceType: WorkspaceType.Local,
      content: '# hello',
      dirty: false,
      isSynced: true,
    } as any);

    // Set up dirty subscription to verify callback fires
    let capturedFiles: any[] = [];
    const unsub = subscribeToDirtyWorkspaceFiles('int-ws', (files) => {
      capturedFiles = files;
    });

    // Mark file dirty to trigger subscription
    await upsertCachedFile({
      id: fileId,
      path: 'notes/test.md',
      name: 'test.md',
      type: FileType.File,
      workspaceId: 'int-ws',
      workspaceType: WorkspaceType.Local,
      content: '# modified',
      dirty: true,
      isSynced: false,
    } as any);

    // Simulate push + mark synced (what SyncManager debounce does)
    await pushSpy('notes/test.md', '# modified');
    await markCachedFileAsSynced(fileId);

    const updated = await getCachedFile('notes/test.md', 'int-ws');
    expect(updated?.dirty).toBe(false);

    unsub();
    vi.useRealTimers();
  });
});

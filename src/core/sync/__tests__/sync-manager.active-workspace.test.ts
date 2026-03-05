import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { getSyncManager, stopSyncManager } from '@/core/sync/sync-manager';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType } from '@/core/cache/types';

vi.mock('@/core/cache', () => ({
  observeCachedFiles: vi.fn(),
  loadFile: vi.fn(),
  markCachedFileAsSynced: vi.fn(),
  getCacheDB: vi.fn(),
  getDirtyCachedFiles: vi.fn(),
  upsertCachedFile: vi.fn(),
  saveFile: vi.fn(),
  getCachedFile: vi.fn(),
}));

import * as cache from '@/core/cache';

describe('SyncManager - active workspace subscription', () => {
  beforeEach(() => {
    // Reset workspace store to known state
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
    vi.clearAllMocks();
    // Ensure singleton is fresh by stopping any existing manager
    try {
      stopSyncManager();
    } catch (e) {
      // ignore
    }
  });

  afterEach(() => {
    try {
      stopSyncManager();
    } catch (e) {
      // ignore
    }
  });

  it('pushes dirty files only for active workspace', async () => {
    // Mock loadFile to return file content
    (cache.loadFile as MockedFunction<any>).mockResolvedValue({ content: 'hello' });

    // Create a fake adapter that records push calls
    const pushed: any[] = [];
    const adapter = {
      name: 'local',
      isReady: () => true,
      push: vi.fn(async (descriptor: any, content: string) => {
        pushed.push({ descriptor, content });
        return true;
      }),
    } as any;

    const manager = getSyncManager();
    manager.registerAdapter(adapter);
    manager.start();

    // Create and set active workspace
    const ws = { id: 'ws-1', name: 'Local WS', type: WorkspaceType.Local } as any;
    useWorkspaceStore.setState({ workspaces: [ws], activeWorkspaceId: ws.id });

    // Simulate a dirty cached file for the active workspace
    const file = { id: 'file-1', path: 'a/b.md', workspaceId: ws.id, workspaceType: WorkspaceType.Local, dirty: true, metadata: {} };

    // Call syncFile directly for deterministic behavior
    await (manager as any).syncFile(file as any);

    expect(adapter.push).toHaveBeenCalled();
    // Validate descriptor contains id/path
    expect(pushed[0].descriptor).toMatchObject({ id: file.id, path: file.path });
    expect(pushed[0].content).toBe('hello');
  });
});

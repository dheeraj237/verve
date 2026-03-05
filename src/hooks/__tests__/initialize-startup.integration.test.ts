import { vi } from 'vitest';
import { WorkspaceType } from '@/core/cache';
import 'fake-indexeddb/auto';

describe('app startup pulls', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');
    // set a non-browser workspace as active
    useWorkspaceStore.setState({
      workspaces: [
        { id: 'verve-samples', name: 'Verve Samples', type: WorkspaceType.Browser },
        { id: 'ws-start', name: 'StartWS', type: WorkspaceType.GDrive, path: '/' },
      ],
      activeWorkspaceId: 'ws-start',
    });
  });

  it('invokes pullWorkspace on the SyncManager during initializeApp', async () => {
    // Prepare a mock getSyncManager that spies on pullWorkspace
    const pullMock = vi.fn(async () => { });
    vi.doMock('@/core/sync/sync-manager', () => ({
      initializeSyncManager: async (adapters: any[]) => {
        // Return a dummy manager
        return { pullWorkspace: pullMock };
      },
      getSyncManager: () => ({ pullWorkspace: pullMock }),
    }));

    const { initializeApp } = await import('@/hooks/use-browser-mode');

    // Run initialization; it should call pullWorkspace for the active non-browser workspace
    await initializeApp([]);

    expect(pullMock).toHaveBeenCalled();
  });
  
  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/file-manager');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {
      // ignore
    }
    try {
      const { stopSyncManager } = await import('@/core/sync/sync-manager');
      stopSyncManager();
    } catch (_) {}
  });
});

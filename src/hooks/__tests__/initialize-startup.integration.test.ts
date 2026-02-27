import 'fake-indexeddb/auto';

describe('app startup pulls', () => {
  beforeEach(() => {
    jest.resetModules();
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    // set a non-browser workspace as active
    useWorkspaceStore.setState({
      workspaces: [
        { id: 'verve-samples', name: 'Verve Samples', type: 'browser' },
        { id: 'ws-start', name: 'StartWS', type: 'gdrive', path: '/' },
      ],
      activeWorkspaceId: 'ws-start',
    });
  });

  it('invokes pullWorkspace on the SyncManager during initializeApp', async () => {
    // Prepare a mock getSyncManager that spies on pullWorkspace
    const pullMock = jest.fn(async () => {});
    jest.doMock('@/core/sync/sync-manager', () => ({
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
      const { getCacheDB } = await import('@/core/cache/rxdb');
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

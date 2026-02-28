import 'fake-indexeddb/auto';

// Keep integration tests bounded so CI/dev runners don't wait indefinitely
jest.setTimeout(10000);

describe('workspace CRUD integration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('creates, lists, reads and deletes a workspace', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { WorkspaceType } = require('@/core/cache/types');
    const fileOps = await import('@/core/cache/file-operations');

    await fileOps.initializeFileOperations();

    // Start clean
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });

    // Create a new workspace via public API
    useWorkspaceStore.getState().createWorkspace('My Workspace', WorkspaceType.Browser, { id: 'my-ws' });

    // Workspace should be in the store and active
    const store = useWorkspaceStore.getState();
    expect(store.workspaces.some((w: any) => w.id === 'my-ws')).toBeTruthy();
    expect(store.activeWorkspaceId).toBe('my-ws');

    // The default verve.md is created asynchronously; wait via RxDB subscription
    const { observeCachedFiles } = await import('@/core/cache');
    await new Promise<void>((resolve) => {
      const sub: any = observeCachedFiles((files: any[]) => {
        const f = files.find((x) => (x.path || '').endsWith('verve.md') && x.workspaceId === 'my-ws');
        if (f && f.content && f.content.length > 0) {
          try { sub.unsubscribe(); } catch (_) { }
          resolve();
        }
      });
      // fallback timeout
      setTimeout(() => { try { sub.unsubscribe(); } catch (_) { }; resolve(); }, 2000);
    });

    const loaded = await fileOps.loadFile('verve.md', 'browser', 'my-ws');
    expect(loaded).toBeDefined();
    expect(loaded.content).toBe('# Verve 🚀');

    // List workspaces via store helpers
    const browserWS = useWorkspaceStore.getState().getBrowserWorkspaces();
    expect(browserWS.some((w: any) => w.id === 'my-ws')).toBeTruthy();

    // Delete the workspace and verify removal
    useWorkspaceStore.getState().deleteWorkspace('my-ws');
    const after = useWorkspaceStore.getState();
    expect(after.workspaces.some((w: any) => w.id === 'my-ws')).toBeFalsy();
    // activeWorkspaceId should be null or another workspace id
    expect(after.activeWorkspaceId === null || typeof after.activeWorkspaceId === 'string').toBeTruthy();
  });
});

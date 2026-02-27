import 'fake-indexeddb/auto';

// Keep integration tests bounded so CI/dev runners don't wait indefinitely
jest.setTimeout(10000);

describe('workspace integration tests', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('switching workspaces reloads files with same hierarchy', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { useEditorStore } = require('@/features/editor/store/editor-store');
    const { WorkspaceType } = require('@/core/cache/types');
    const fileOps = await import('@/core/cache/file-operations');

    await fileOps.initializeFileOperations();

    // Prepare two browser workspaces
    useWorkspaceStore.setState({
      workspaces: [
        { id: 'ws-A', name: 'Workspace A', type: WorkspaceType.Browser },
        { id: 'ws-B', name: 'Workspace B', type: WorkspaceType.Browser },
      ],
      activeWorkspaceId: 'ws-A',
      tabsByWorkspace: {},
    });

    // Create nested files in ws-A
    const f1 = await fileOps.saveFile('/notes/intro.md', 'Intro content', WorkspaceType.Browser, undefined, 'ws-A');
    const f2 = await fileOps.saveFile('/notes/guide/setup.md', 'Setup content', WorkspaceType.Browser, undefined, 'ws-A');

    // Open tabs in editor and save for workspace
    useEditorStore.setState({
      openTabs: [
        { id: f1.id, path: f1.path, name: f1.name, content: f1.content },
        { id: f2.id, path: f2.path, name: f2.name, content: f2.content },
      ],
      activeTabId: f1.id,
    });

    // Persist tabs for ws-A directly into the workspace store to avoid race
    useWorkspaceStore.setState({
      tabsByWorkspace: {
        'ws-A': {
          openTabs: useEditorStore.getState().openTabs,
          activeTabId: f1.id,
        },
      },
    });

    // Switch to ws-B -> should clear editor
    await useWorkspaceStore.getState().switchWorkspace('ws-B');
    expect(useEditorStore.getState().openTabs.length).toBe(0);

    // Switch back to ws-A -> tabs should be restored with correct content
    await useWorkspaceStore.getState().switchWorkspace('ws-A');
    const tabs = useEditorStore.getState().openTabs;
    const paths = tabs.map(t => t.path).sort();
    expect(paths).toEqual(['/notes/guide/setup.md', '/notes/intro.md'].sort());
    const intro = tabs.find(t => t.path === '/notes/intro.md');
    expect(intro?.content).toBe('Intro content');
  }, 10000);

  it('create, read, delete workspaces', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { WorkspaceType } = require('@/core/cache/types');
    const fileOps = await import('@/core/cache/file-operations');

    await fileOps.initializeFileOperations();

    // Start with empty store
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });

    // Create a new workspace
    useWorkspaceStore.getState().createWorkspace('My WS', 'browser', { id: 'my-ws' });
    expect(useWorkspaceStore.getState().workspaces.some((w: any) => w.id === 'my-ws')).toBeTruthy();
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('my-ws');

    // Delete it
    useWorkspaceStore.getState().deleteWorkspace('my-ws');
    expect(useWorkspaceStore.getState().workspaces.some((w: any) => w.id === 'my-ws')).toBeFalsy();
  }, 5000);

  it('new workspace creates verve.md with default content and is visible', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { WorkspaceType } = require('@/core/cache/types');
    const fileOps = await import('@/core/cache/file-operations');

    await fileOps.initializeFileOperations();

    // ensure clean state
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });

    // Create a new browser workspace
    useWorkspaceStore.getState().createWorkspace('New WS', 'browser', { id: 'new-ws' });

    // give any async init a moment
    await new Promise(res => setTimeout(res, 20));

    const all = await fileOps.getAllFiles('new-ws');
    const verveMeta = all.find((f: any) => (f.path || '').endsWith('verve.md') || f.name === 'verve.md');
    expect(verveMeta).toBeDefined();

    const loaded = await fileOps.loadFile('verve.md', 'browser', 'new-ws');
    expect(loaded.content).toBe('# Verve 🚀');
  }, 5000);

  it('workspace types: gdrive adapter pull populates RxDB and push is invoked on enqueue', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { WorkspaceType } = require('@/core/cache/types');
    const { getSyncManager, stopSyncManager } = await import('@/core/sync/sync-manager');
    const fileOps = await import('@/core/cache/file-operations');

    await fileOps.initializeFileOperations();

    // Create a non-browser workspace
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
    useWorkspaceStore.getState().createWorkspace('GDrive WS', 'gdrive', { id: 'gdrive-1' });

    // Prepare mock adapter
    const pullWorkspaceMock = jest.fn(async (workspaceId: any) => {
      return [
        { fileId: '/gdrive/remote.md', content: 'remote file content' },
      ];
    });
    const pushMock = jest.fn(async () => true);

    const mockAdapter: any = {
      name: 'gdrive',
      pullWorkspace: pullWorkspaceMock,
      pull: async (id: string) => 'remote file content',
      push: pushMock,
      listWorkspaceFiles: async () => [{ id: '/gdrive/remote.md', path: '/gdrive/remote.md' }],
    };

    // Register adapter and start manager
    const mgr = getSyncManager();
    mgr.registerAdapter(mockAdapter);
    mgr.start();

    // Switch to the gdrive workspace; this should invoke pullWorkspace and populate RxDB
    await useWorkspaceStore.getState().switchWorkspace('gdrive-1');
    expect(pullWorkspaceMock).toHaveBeenCalled();

    // Verify pulled file exists in cache
    const all = await fileOps.getAllFiles('gdrive-1');
    expect(all.some(f => f.path === '/gdrive/remote.md')).toBeTruthy();

    // Create a new file in workspace and trigger enqueueAndProcess to push
    const saved = await fileOps.saveFile('/gdrive/new.md', 'local content', 'gdrive', undefined, 'gdrive-1');
    // enqueueAndProcess should attempt to push via adapter
    await mgr.enqueueAndProcess(saved.id, saved.path, 'gdrive', 'gdrive-1');
    // give background tasks a moment
    await new Promise(res => setTimeout(res, 50));
    expect(pushMock).toHaveBeenCalled();

    // cleanup
    stopSyncManager();
  }, 10000);

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/rxdb');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
    try {
      const { stopSyncManager } = await import('@/core/sync/sync-manager');
      stopSyncManager();
    } catch (_) {}
  });
});

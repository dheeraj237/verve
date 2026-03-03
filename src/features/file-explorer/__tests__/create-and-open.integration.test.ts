import 'fake-indexeddb/auto';

jest.setTimeout(20000);

describe('create file and open it via editor', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('creating a file then opening it loads its content', async () => {
    const fileOps = await import('@/core/cache/file-manager');
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');
    const { useFileExplorerStore } = await import('@/features/file-explorer/store/file-explorer-store');
    const { useEditorStore } = await import('@/features/editor/store/editor-store');
    const { WorkspaceType } = require('@/core/cache/types');

    await fileOps.initializeFileOperations();

    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-open', name: 'Open WS', type: WorkspaceType.Browser }], activeWorkspaceId: 'ws-open' });

    // create a file via the store API (this will save to RxDB and refresh the directory)
    await useFileExplorerStore.getState().createFile('', 'open-me.md');

    // Ensure cache did not accidentally store HTML content for new file
    const cache = await import('@/core/cache');
    const created = await cache.getCachedFile('open-me.md');
    expect(created).toBeDefined();
    expect((created?.content || '')).not.toMatch(/<\/?html/i);

    // Now open the file by path via editor (simulates clicking the file in tree)
    await useEditorStore.getState().openFileByPath('open-me.md');

    const editorState = useEditorStore.getState();
    const opened = editorState.openTabs.find(t => t.name === 'open-me.md');
    expect(opened).toBeDefined();
    // Created file has empty content by default
    expect(opened?.content).toBe('');
  });

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/file-manager');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
  });
});

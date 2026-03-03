import 'fake-indexeddb/auto';

jest.setTimeout(10000);

describe('file explorer preserve tree on create/delete', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('creating a file should not remove other existing root files', async () => {
    const fileOps = await import('@/core/cache/file-manager');
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');
    const { useFileExplorerStore } = await import('@/features/file-explorer/store/file-explorer-store');
    const { WorkspaceType } = require('@/core/cache/types');

    await fileOps.initializeFileOperations();

    // Setup workspace and two root files
    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-preserve', name: 'Preserve WS', type: WorkspaceType.Browser }], activeWorkspaceId: 'ws-preserve' });

    await fileOps.saveFile('/one.md', 'one', WorkspaceType.Browser, undefined, 'ws-preserve');
    await fileOps.saveFile('/two.md', 'two', WorkspaceType.Browser, undefined, 'ws-preserve');

    // Refresh store tree
    await useFileExplorerStore.getState().refreshFileTree();

    const beforeTree = useFileExplorerStore.getState().getFileTree();
    const before = (beforeTree || []).map((n: any) => n.name);
    expect(before).toContain('one.md');
    expect(before).toContain('two.md');

    // Create a new root file via store API (this calls saveFile and updates the directory)
    await useFileExplorerStore.getState().createFile('', 'three.md');

    // Ensure the created file did not receive HTML content
    const cache = await import('@/core/cache');
    const created = await cache.getCachedFile('three.md');
    expect(created).toBeDefined();
    expect((created?.content || '')).not.toMatch(/<\/?html/i);

    const afterTree = useFileExplorerStore.getState().getFileTree();
    const after = (afterTree || []).map((n: any) => n.name);
    expect(after).toContain('one.md');
    expect(after).toContain('two.md');
    expect(after).toContain('three.md');
  });

  it('deleting a file should not remove other existing root files', async () => {
    const fileOps = await import('@/core/cache/file-manager');
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');
    const { useFileExplorerStore } = await import('@/features/file-explorer/store/file-explorer-store');
    const { WorkspaceType } = require('@/core/cache/types');

    await fileOps.initializeFileOperations();

    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-preserve-del', name: 'PreserveDel WS', type: WorkspaceType.Browser }], activeWorkspaceId: 'ws-preserve-del' });

    await fileOps.saveFile('/a.md', 'a', WorkspaceType.Browser, undefined, 'ws-preserve-del');
    await fileOps.saveFile('/b.md', 'b', WorkspaceType.Browser, undefined, 'ws-preserve-del');

    await useFileExplorerStore.getState().refreshFileTree();

    const beforeTree2 = useFileExplorerStore.getState().getFileTree();
    const before2 = (beforeTree2 || []).map((n: any) => n.name);
    expect(before2).toContain('a.md');
    expect(before2).toContain('b.md');

    // Delete one file
    await useFileExplorerStore.getState().deleteNode('/a.md', false);

    const afterTree2 = useFileExplorerStore.getState().getFileTree();
    const after2 = (afterTree2 || []).map((n: any) => n.name);
    expect(after2).not.toContain('a.md');
    expect(after2).toContain('b.md');
  });

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/file-manager');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
  });
});

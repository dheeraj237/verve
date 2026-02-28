import 'fake-indexeddb/auto';

jest.setTimeout(10000);

describe('file-explorer root create & workspace switch behavior', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('uses currentDirectoryPath as root when creating a new file', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { useFileExplorerStore } = require('@/features/file-explorer/store/file-explorer-store');
    const fileOps = await import('@/core/cache/file-operations');
    const { WorkspaceType } = require('@/core/cache/types');

    await fileOps.initializeFileOperations();

    // Setup a browser workspace and make it active
    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-root', name: 'Root WS', type: WorkspaceType.Browser }], activeWorkspaceId: 'ws-root' });

    // Ensure the store is aware of the active workspace and has default root
    await useFileExplorerStore.getState().refreshFileTree();

    // Set an explicit currentDirectoryPath (simulates opening a folder or context)
    useFileExplorerStore.getState().setCurrentDirectory('MyRoot', '/myroot');

    // Create a new file using the store API, simulating the component passing the computed rootPath
    await useFileExplorerStore.getState().createFile('/myroot', 'created.md');

    // Verify the file exists in RxDB under the expected path for the active workspace
    const loaded = await fileOps.loadFile('/myroot/created.md', WorkspaceType.Browser);
    expect(loaded).toBeDefined();
    expect(loaded.path).toBe('/myroot/created.md');
  });

  it('switching active workspace changes currentDirectory and new creates go to the then-active root', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { useFileExplorerStore } = require('@/features/file-explorer/store/file-explorer-store');
    const fileOps = await import('@/core/cache/file-operations');
    const { WorkspaceType } = require('@/core/cache/types');

    await fileOps.initializeFileOperations();

    // Create two browser workspaces
    useWorkspaceStore.setState({ workspaces: [
      { id: 'ws-a', name: 'Workspace A', type: WorkspaceType.Browser },
      { id: 'ws-b', name: 'Workspace B', type: WorkspaceType.Browser },
    ], activeWorkspaceId: 'ws-a' });

    // Refresh tree for active workspace A and set its currentDirectoryPath
    await useFileExplorerStore.getState().refreshFileTree();
    useFileExplorerStore.getState().setCurrentDirectory('A', '/root-a');

    // Create file in workspace A
    await useFileExplorerStore.getState().createFile('/root-a', 'a-file.md');

    // Switch active workspace to B
    useWorkspaceStore.setState({ activeWorkspaceId: 'ws-b' });

    // Refresh tree for B and set its directory
    await useFileExplorerStore.getState().refreshFileTree();
    useFileExplorerStore.getState().setCurrentDirectory('B', '/root-b');

    // Simulate user opened new-file input earlier but confirmed after switching workspace.
    // The actual component computes rootPath at confirm time, so we simulate confirmation now.
    await useFileExplorerStore.getState().createFile('/root-b', 'b-file.md');

    // Verify files exist under correct workspace-scoped paths in RxDB
    const aLoaded = await fileOps.loadFile('/root-a/a-file.md', WorkspaceType.Browser, 'ws-a');
    const bLoaded = await fileOps.loadFile('/root-b/b-file.md', WorkspaceType.Browser, 'ws-b');

    expect(aLoaded).toBeDefined();
    expect(aLoaded.path).toBe('/root-a/a-file.md');

    expect(bLoaded).toBeDefined();
    expect(bLoaded.path).toBe('/root-b/b-file.md');
  });

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/rxdb');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
  });
});

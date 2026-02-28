import 'fake-indexeddb/auto';

jest.setTimeout(10000);

describe('local workspace create updates file tree immediately', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('creates a file in RxDB and updates the file tree for Local workspace', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { useFileExplorerStore } = require('@/features/file-explorer/store/file-explorer-store');
    const fileOps = await import('@/core/cache/file-operations');
    const { WorkspaceType } = require('@/core/cache/types');

    // Ensure RxDB is initialized
    await fileOps.initializeFileOperations();

    // Create a local workspace and set it active
    useWorkspaceStore.setState({
      workspaces: [
        { id: 'local-ws', name: 'Local WS', type: WorkspaceType.Local, createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() }
      ],
      activeWorkspaceId: 'local-ws'
    });

    // Refresh tree (no directory handle available in test environment)
    await useFileExplorerStore.getState().refreshFileTree();

    // Create a new file via the store API
    await useFileExplorerStore.getState().createFile('', 'instant-local.md');

    // The store should immediately reflect the new file by reading from RxDB
    const tree = useFileExplorerStore.getState().fileTree;
    const found = tree.some(node => node.name === 'instant-local.md' || node.path === 'instant-local.md');

    expect(found).toBe(true);
  });

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/rxdb');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
  });
});

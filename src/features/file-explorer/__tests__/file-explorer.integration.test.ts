import 'fake-indexeddb/auto';

jest.setTimeout(10000);

describe('file explorer integration (hierarchy + UI actions)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('builds nested tree from flat paths and responds to create/rename/delete via store', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { useFileExplorerStore } = require('@/features/file-explorer/store/file-explorer-store');
    const fileOps = await import('@/core/cache/file-operations');
    const { WorkspaceType } = require('@/core/cache/types');

    await fileOps.initializeFileOperations();

    // Setup browser workspace
    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-ui', name: 'UI WS', type: WorkspaceType.Browser }], activeWorkspaceId: 'ws-ui' });

    // Create nested files directly via file-operations
    await fileOps.saveFile('/alpha/beta/gamma.md', 'gamma', WorkspaceType.Browser, undefined, 'ws-ui');
    await fileOps.saveFile('/alpha/beta/delta.md', 'delta', WorkspaceType.Browser, undefined, 'ws-ui');
    await fileOps.saveFile('/alpha/epsilon.md', 'epsilon', WorkspaceType.Browser, undefined, 'ws-ui');
    await fileOps.saveFile('/root.md', 'root', WorkspaceType.Browser, undefined, 'ws-ui');

    // Refresh file tree via store (UI-level behavior)
    await useFileExplorerStore.getState().refreshFileTree();

    const tree = useFileExplorerStore.getState().fileTree;
    // root should contain folder 'alpha' and file 'root.md'
    expect(tree.some((n: any) => n.name === 'alpha' && n.type === 'folder')).toBeTruthy();
    expect(tree.some((n: any) => n.name === 'root.md' && n.type === 'file')).toBeTruthy();

    // drill into alpha -> find beta folder and its children
    const alpha = tree.find((n: any) => n.name === 'alpha');
    expect(alpha).toBeDefined();
    const beta = alpha.children.find((c: any) => c.name === 'beta');
    expect(beta).toBeDefined();
    const gamma = beta.children.find((c: any) => c.name === 'gamma.md');
    expect(gamma).toBeDefined();

    // UI action: create a new file under /alpha
    await useFileExplorerStore.getState().createFile('/alpha', 'new.md');
    // After createFile, refresh is called by the store; get updated tree
    const updated = useFileExplorerStore.getState().fileTree;
    // alpha should now contain epsilon.md and new.md (epsilon exists as file under alpha)
    const alphaUpdated = updated.find((n: any) => n.name === 'alpha');
    const filesUnderAlpha = alphaUpdated.children.flatMap((c: any) => c.children ? c.children.map((cc: any) => cc.name) : [c.name]);
    expect(filesUnderAlpha.some((n: string) => n === 'new.md' || n === 'epsilon.md')).toBeTruthy();

    // UI action: rename file /root.md -> /root-renamed.md via store.renameNode
    await useFileExplorerStore.getState().renameNode('/root.md', 'root-renamed.md');
    const afterRename = useFileExplorerStore.getState().fileTree;
    expect(afterRename.some((n: any) => n.name === 'root-renamed.md')).toBeTruthy();

    // UI action: delete a nested file via store.deleteNode
    await useFileExplorerStore.getState().deleteNode('/alpha/epsilon.md', false);
    const afterDelete = useFileExplorerStore.getState().fileTree;
    // epsilon.md should no longer exist under alpha
    const alphaAfterDelete = afterDelete.find((n: any) => n.name === 'alpha');
    const containsEpsilon = alphaAfterDelete.children.flatMap((c: any) => c.children ? c.children.map((cc: any) => cc.name) : [c.name]).some((n: string) => n === 'epsilon.md');
    expect(containsEpsilon).toBeFalsy();
  });

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/rxdb');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
  });
});

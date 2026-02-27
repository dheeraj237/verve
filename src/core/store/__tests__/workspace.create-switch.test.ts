import 'fake-indexeddb/auto';

// Keep integration tests bounded so CI/dev runners don't wait indefinitely
jest.setTimeout(10000);

describe('workspace create & switch integration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('creating workspaces and switching restores workspace-specific tabs and hierarchy', async () => {
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    const { useEditorStore } = require('@/features/editor/store/editor-store');
    const { WorkspaceType } = require('@/core/cache/types');
    const fileOps = await import('@/core/cache/file-operations');

    await fileOps.initializeFileOperations();

    // Start clean
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null, tabsByWorkspace: {} });

    // Create workspace A and B via the public API
    useWorkspaceStore.getState().createWorkspace('Workspace A', WorkspaceType.Browser, { id: 'ws-A' });
    useWorkspaceStore.getState().createWorkspace('Workspace B', WorkspaceType.Browser, { id: 'ws-B' });

    // Switch to ws-A so editor state belongs to ws-A
    await useWorkspaceStore.getState().switchWorkspace('ws-A');

    // Save nested files into ws-A
    const f1 = await fileOps.saveFile('/notes/intro.md', 'Intro content', WorkspaceType.Browser, undefined, 'ws-A');
    const f2 = await fileOps.saveFile('/notes/guide/setup.md', 'Setup content', WorkspaceType.Browser, undefined, 'ws-A');

    // Simulate editor having opened these tabs while in ws-A
    useEditorStore.setState({
      openTabs: [
        { id: f1.id, path: f1.path, name: f1.name, content: f1.content },
        { id: f2.id, path: f2.path, name: f2.name, content: f2.content },
      ],
      activeTabId: f1.id,
    });

    // Persist tabs for ws-A
    useWorkspaceStore.getState().saveTabsForWorkspace('ws-A');

    // Switch to ws-B -> should clear editor tabs
    await useWorkspaceStore.getState().switchWorkspace('ws-B');
    expect(useEditorStore.getState().openTabs.length).toBe(0);

    // Switch back to ws-A -> tabs should be restored with correct content
    await useWorkspaceStore.getState().switchWorkspace('ws-A');
    const tabs = useEditorStore.getState().openTabs;
    const paths = tabs.map((t: any) => t.path).sort();
    expect(paths).toEqual(['/notes/guide/setup.md', '/notes/intro.md'].sort());
    const intro = tabs.find((t: any) => t.path === '/notes/intro.md');
    expect(intro?.content).toBe('Intro content');
  });
});

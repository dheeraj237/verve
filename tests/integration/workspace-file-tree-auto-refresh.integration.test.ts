/**
 * Integration: workspace creation and switching must auto-refresh the file explorer tree.
 *
 * These tests capture three bugs:
 *  1. createWorkspace() does not call refreshFileTree() after the background verve.md creation,
 *     so users see an empty tree until they manually reload.
 *  2. switchWorkspace() does not call refreshFileTree() after the switch completes,
 *     so the tree still shows the previous workspace's files.
 *  3. The module-level workspace-change subscription in file-explorer-store uses the wrong
 *     Zustand subscribe API (two-arg selector form without subscribeWithSelector middleware),
 *     so the per-workspace RxDB file subscription is never re-established on workspace change.
 */
import 'fake-indexeddb/auto';
import { initFileOps, destroyCacheDB, createWorkspace } from '@/tests/helpers/test-utils';
import { saveFile } from '@/core/cache/file-manager';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { useFileExplorerStore } from '@/features/file-explorer/store/file-explorer-store';
import { WorkspaceType } from '@/core/cache/types';

const DEFAULT_FILE = 'verve.md';

/** Flatten a file tree (recursive children) into a flat array of nodes. */
function flattenTree(nodes: any[]): any[] {
  return nodes.flatMap(n => (n.children?.length ? [n, ...flattenTree(n.children)] : [n]));
}

/**
 * Poll `getFileTree()` until the predicate is satisfied or the timeout elapses.
 * Returns `true` when the predicate passes, `false` on timeout.
 */
async function waitForTree(
  predicate: (nodes: any[]) => boolean,
  timeoutMs = 5000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tree = useFileExplorerStore.getState().getFileTree() ?? [];
    if (predicate(flattenTree(tree))) return true;
    await new Promise(r => setTimeout(r, 60));
  }
  return false;
}

describe('Integration: workspace create/switch auto-refreshes file explorer', () => {
  beforeEach(async () => {
    await initFileOps();
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
    useFileExplorerStore.setState({
      fileMap: {},
      rootIds: [],
      expandedFolders: new Set(),
      selectedFileId: null,
    } as any);
  });

  afterEach(async () => {
    try { await destroyCacheDB(); } catch (_) {}
  });

  // ─── Bug 1: createWorkspace does not refresh after default file is written ───

  it('browser workspace creation: file tree shows verve.md without manual refreshFileTree', async () => {
    // createWorkspace is synchronous in terms of store state but kicks off an async
    // background operation that writes verve.md and should then call refreshFileTree.
    await createWorkspace('Auto WS', WorkspaceType.Browser, 'auto-browser-ws');

    // Assert WITHOUT ever calling refreshFileTree() manually
    const found = await waitForTree(nodes => nodes.some(n => n.name === DEFAULT_FILE));
    expect(found).toBe(true);
  });

  // ─── Bug 2: switchWorkspace does not refresh the file explorer ───

  it('switchWorkspace: file tree reflects the new workspace files after switching', async () => {
    // Workspace A with a unique file
    await createWorkspace('WS-A', WorkspaceType.Browser, 'auto-ws-a');
    await saveFile('only-in-a.md', '# A', WorkspaceType.Browser, undefined, 'auto-ws-a');

    // Workspace B with a different unique file
    await createWorkspace('WS-B', WorkspaceType.Browser, 'auto-ws-b');
    await saveFile('only-in-b.md', '# B', WorkspaceType.Browser, undefined, 'auto-ws-b');

    // Switch back to WS-A
    await useWorkspaceStore.getState().switchWorkspace('auto-ws-a');

    // The tree should show WS-A's file, not WS-B's, without manual refresh
    const wsAShown = await waitForTree(
      nodes => nodes.some(n => n.name === 'only-in-a.md'),
    );
    expect(wsAShown).toBe(true);

    // WS-B file must not appear in WS-A's tree
    const tree = useFileExplorerStore.getState().getFileTree() ?? [];
    const all = flattenTree(tree);
    expect(all.some(n => n.name === 'only-in-b.md')).toBe(false);
  });

  // ─── Bug 3: RxDB subscription re-subscribes when active workspace changes ───

  it('adding a file to the active workspace updates the tree automatically via subscription', async () => {
    await createWorkspace('Sub WS', WorkspaceType.Browser, 'sub-ws');

    // Wait for initial auto-refresh (verve.md)
    await waitForTree(nodes => nodes.some(n => n.name === DEFAULT_FILE));

    // Write a new file directly into RxDB — the subscription should pick this up
    await saveFile('subscription-check.md', '# sub', WorkspaceType.Browser, undefined, 'sub-ws');

    // The tree should update automatically via the RxDB → file-explorer subscription
    const found = await waitForTree(nodes => nodes.some(n => n.name === 'subscription-check.md'));
    expect(found).toBe(true);
  });

  // ─── Regression: switching back shows correct isolated trees ───

  it('repeated workspace switches always show the correct workspace files', async () => {
    await createWorkspace('R-WS-1', WorkspaceType.Browser, 'r-ws-1');
    await saveFile('file-r1.md', '# R1', WorkspaceType.Browser, undefined, 'r-ws-1');

    await createWorkspace('R-WS-2', WorkspaceType.Browser, 'r-ws-2');
    await saveFile('file-r2.md', '# R2', WorkspaceType.Browser, undefined, 'r-ws-2');

    // Switch: WS-1 → WS-2 → WS-1
    await useWorkspaceStore.getState().switchWorkspace('r-ws-1');
    const ws1Shown = await waitForTree(nodes => nodes.some(n => n.name === 'file-r1.md'));
    expect(ws1Shown).toBe(true);
    expect(flattenTree(useFileExplorerStore.getState().getFileTree() ?? []).some(n => n.name === 'file-r2.md')).toBe(false);

    await useWorkspaceStore.getState().switchWorkspace('r-ws-2');
    const ws2Shown = await waitForTree(nodes => nodes.some(n => n.name === 'file-r2.md'));
    expect(ws2Shown).toBe(true);
    expect(flattenTree(useFileExplorerStore.getState().getFileTree() ?? []).some(n => n.name === 'file-r1.md')).toBe(false);
  });
});

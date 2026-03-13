import 'fake-indexeddb/auto';
import { initFileOps, destroyCacheDB, createWorkspace } from '@/tests/helpers/test-utils';
import { getAllFiles, loadFile } from '@/core/cache/file-manager';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { useFileExplorerStore } from '@/features/file-explorer/store/file-explorer-store';
import { WorkspaceType } from '@/core/cache/types';

const DEFAULT_FILE_NAME = 'verve.md';
const DEFAULT_FILE_CONTENT = '# Verve 🚀';

/**
 * Polls RxDB until the named file appears in the workspace's cache, or the timeout elapses.
 * Returns `true` when the file is found, `false` on timeout.
 */
async function waitForCachedFile(workspaceId: string, fileName: string, timeoutMs = 4000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = await getAllFiles(workspaceId);
    if (files.some(f => f.name === fileName)) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

/** Flattens a file tree (recursive children) into a flat array. */
function flattenTree(nodes: any[]): any[] {
  return nodes.flatMap(n => (n.children?.length ? [n, ...flattenTree(n.children)] : [n]));
}

describe('Integration: default verve.md created for new workspaces', () => {
  beforeEach(async () => {
    await initFileOps();
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
    useFileExplorerStore.setState({ fileMap: {}, rootIds: [], fileTree: [], expandedFolders: new Set(), selectedFileId: null });
  });

  afterEach(async () => {
    try {
      await destroyCacheDB();
    } catch (_) {
      // ignore teardown errors
    }
  });

  it('browser workspace: switches to the new workspace and renders verve.md in file explorer', async () => {
    const wsId = 'test-browser-ws';

    await createWorkspace('My Browser WS', WorkspaceType.Browser, wsId);

    // Workspace store should immediately reflect the new active workspace
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(wsId);
    const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
    expect(activeWs).toBeDefined();
    expect(activeWs!.id).toBe(wsId);
    expect(activeWs!.type).toBe(WorkspaceType.Browser);

    // Wait for the background async creation of the default file
    const found = await waitForCachedFile(wsId, DEFAULT_FILE_NAME);
    expect(found).toBe(true);

    // Verify file content written to cache is correct
    const fileData = await loadFile(DEFAULT_FILE_NAME, WorkspaceType.Browser, wsId);
    expect(fileData.content).toBe(DEFAULT_FILE_CONTENT);

    // Refresh file explorer and verify verve.md appears in the tree
    await useFileExplorerStore.getState().refreshFileTree();
    const allNodes = flattenTree(useFileExplorerStore.getState().getFileTree() ?? []);
    const verveNode = allNodes.find(n => n.name === DEFAULT_FILE_NAME || n.path === DEFAULT_FILE_NAME);
    expect(verveNode).toBeDefined();
  });

  it('gdrive workspace: default verve.md is created in the cache', async () => {
    const wsId = 'test-gdrive-ws';

    await createWorkspace('My Google Drive WS', WorkspaceType.GDrive, wsId);

    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(wsId);

    const found = await waitForCachedFile(wsId, DEFAULT_FILE_NAME);
    expect(found).toBe(true);

    const fileData = await loadFile(DEFAULT_FILE_NAME, WorkspaceType.GDrive, wsId);
    expect(fileData.content).toBe(DEFAULT_FILE_CONTENT);
  });

  it('s3 workspace: default verve.md is created in the cache', async () => {
    const wsId = 'test-s3-ws';

    await createWorkspace('My S3 WS', WorkspaceType.S3, wsId);

    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(wsId);

    const found = await waitForCachedFile(wsId, DEFAULT_FILE_NAME);
    expect(found).toBe(true);

    const fileData = await loadFile(DEFAULT_FILE_NAME, WorkspaceType.S3, wsId);
    expect(fileData.content).toBe(DEFAULT_FILE_CONTENT);
  });

  it('local workspace: no default verve.md is created (filesystem is the source of truth)', async () => {
    const wsId = 'test-local-ws';

    await createWorkspace('My Local WS', WorkspaceType.Local, wsId);

    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(wsId);

    // Allow enough time for any accidental background creation to settle
    await new Promise(r => setTimeout(r, 300));

    const files = await getAllFiles(wsId);
    const hasDefaultFile = files.some(f => f.name === DEFAULT_FILE_NAME);
    expect(hasDefaultFile).toBe(false);
  });
});

import { initializeRxDB, closeCacheDB, upsertCachedFile, getAllFiles } from '@/core/cache';
import { saveFile } from '@/core/cache/file-manager';
import { FileType, WorkspaceType } from '@/core/cache/types';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { useFileExplorerStore } from '@/features/file-explorer/store/file-explorer-store';

jest.setTimeout(20000);

describe('Integration: preserve tree on create', () => {
  beforeEach(async () => {
    try { await initializeRxDB(); } catch (e) { /* ignore */ }
    // reset workspace and explorer store
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
    useFileExplorerStore.setState({ fileMap: {}, rootIds: [], fileTree: [], expandedFolders: new Set(), selectedFileId: null });
  });

  afterEach(async () => {
    try { await closeCacheDB(); } catch (e) { /* ignore */ }
  });

  it('keeps folder expanded and includes new child after create', async () => {
    const wsId = 'preserve-ws';
    // set active workspace
    useWorkspaceStore.setState({ workspaces: [{ id: wsId, name: 'Preserve WS', type: WorkspaceType.Browser, createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() }], activeWorkspaceId: wsId });

    // Create explicit folder doc with known id
    await upsertCachedFile({ id: 'folder-a', name: 'a', path: 'a', type: FileType.Dir, workspaceType: WorkspaceType.Browser, workspaceId: wsId, lastModified: Date.now(), dirty: false } as any);

    // Create two sibling files under 'a'
    await upsertCachedFile({ id: 'file-x', name: 'x.md', path: 'a/x.md', type: FileType.File, workspaceType: WorkspaceType.Browser, workspaceId: wsId, lastModified: Date.now(), dirty: false } as any);
    await upsertCachedFile({ id: 'file-y', name: 'y.md', path: 'a/y.md', type: FileType.File, workspaceType: WorkspaceType.Browser, workspaceId: wsId, lastModified: Date.now(), dirty: false } as any);

    // Initial refresh to populate store
    await useFileExplorerStore.getState().refreshFileTree();

    // Ensure folder 'a' exists in fileMap and set it as expanded
    const state1 = useFileExplorerStore.getState();
    const folderNode = Object.values(state1.fileMap).find(n => n.path === 'a');
    expect(folderNode).toBeDefined();
    const folderId = folderNode!.id;

    // Mark folder expanded
    useFileExplorerStore.setState({ expandedFolders: new Set([folderId]) });

    // Create a new file inside 'a' via saveFile (this will call ensureParentFoldersForPath)
    await saveFile('a/z.md', '# new', WorkspaceType.Browser, undefined, wsId);

    // Refresh tree after create
    await useFileExplorerStore.getState().refreshFileTree();

    const state2 = useFileExplorerStore.getState();

    // Folder should still be present and expanded
    expect(state2.fileMap[folderId]).toBeDefined();
    expect(Array.from(state2.expandedFolders)).toContain(folderId);

    // Children of folder should include the three files (ids)
    const children = (state2.fileMap[folderId] as any).children as string[] | undefined;
    expect(children && children.length).toBeGreaterThanOrEqual(3);

    // Verify the new file exists in RxDB and in fileMap
    const all = await getAllFiles(wsId);
    const hasZ = all.find(f => f.path === 'a/z.md');
    expect(hasZ).toBeDefined();

    const newChildId = hasZ!.id;
    expect(children).toContain(newChildId);
  });
});

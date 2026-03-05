import { vi } from 'vitest';

vi.unmock('@/core/rxdb/rxdb-client');

import { initializeFileOperations, upsertCachedFile } from '@/core/cache';
import { destroyRxDB } from '@/core/rxdb/rxdb-client';
import { useFileExplorerStore } from '@/features/file-explorer/store/file-explorer-store';
import { FileType, WorkspaceType } from '@/core/cache/types';

describe('_buildFileTreeFromCache builder', () => {
  beforeEach(async () => {
    try { await initializeFileOperations(); } catch (e) { /* already initialized */ }
    // reset store state
    useFileExplorerStore.setState({ fileMap: {}, rootIds: [], fileTree: [], expandedFolders: new Set(), selectedFileId: null });
  });

  afterEach(async () => {
    try { await destroyRxDB(); } catch (e) { /* ignore */ }
  });

  it('produces id-keyed fileMap with children arrays of ids and correct rootIds', async () => {
    const wsId = 'unit-ws-1';

    // Insert a directory doc for 'folder'
    await upsertCachedFile({ id: 'dir-folder', name: 'folder', path: 'folder', type: FileType.Directory, workspaceType: WorkspaceType.Browser, workspaceId: wsId, lastModified: Date.now(), dirty: false } as any);

    // Files: one in folder, one at root, and a nested file under folder/sub (no dir doc for folder/sub)
    await upsertCachedFile({ id: 'f1', name: 'a.md', path: 'folder/a.md', type: FileType.File, workspaceType: WorkspaceType.Browser, workspaceId: wsId, lastModified: Date.now(), dirty: false } as any);
    await upsertCachedFile({ id: 'f2', name: 'root.md', path: 'root.md', type: FileType.File, workspaceType: WorkspaceType.Browser, workspaceId: wsId, lastModified: Date.now(), dirty: false } as any);
    await upsertCachedFile({ id: 'f3', name: 'b.md', path: 'folder/sub/b.md', type: FileType.File, workspaceType: WorkspaceType.Browser, workspaceId: wsId, lastModified: Date.now(), dirty: false } as any);

    // Call builder
    const tree = await useFileExplorerStore.getState()._buildFileTreeFromCache(wsId);

    const state = useFileExplorerStore.getState();
    const { fileMap, rootIds } = state;

    // fileMap keys must match node.id values
    for (const k of Object.keys(fileMap)) {
      expect(fileMap[k].id).toBe(k);
    }

    // Expect known ids to be present
    expect(Object.keys(fileMap)).toEqual(expect.arrayContaining(['dir-folder', 'f1', 'f2', 'f3', 'node-folder/sub']));

    // Children arrays should be arrays of ids and reference entries in fileMap
    const folder = fileMap['dir-folder'];
    expect(Array.isArray((folder as any).children)).toBe(true);
    for (const cid of (folder as any).children as string[]) {
      expect(typeof cid).toBe('string');
      expect(fileMap[cid]).toBeDefined();
    }

    // rootIds should include the root file; folder should exist in fileMap
    expect(rootIds).toEqual(expect.arrayContaining(['f2']));
    expect(fileMap['dir-folder']).toBeDefined();
  });
});
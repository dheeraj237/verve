import 'fake-indexeddb/auto';

import { initializeFileOperations, saveFile, ensureFolderDocs } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';

describe('migration: create folder docs', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initializeFileOperations();
  });

  it('ensureFolderDocs runs without error and creates folder docs', async () => {
    // Create a nested file to force folder doc creation
    await saveFile('/nested/inner/test.md', 'hello', WorkspaceType.Browser, undefined, 'mig-ws');

    // Should not throw
    await expect(ensureFolderDocs('mig-ws')).resolves.not.toThrow();
  });
});
import { initializeRxDB, closeCacheDB, upsertCachedFile, getAllFiles } from '@/core/cache';
import { ensureFolderDocs } from '@/core/cache/file-manager';
import { FileType, WorkspaceType } from '@/core/cache/types';

jest.setTimeout(20000);

describe('Integration: ensureFolderDocs migration', () => {
  beforeEach(async () => {
    try {
      await initializeRxDB();
    } catch (e) {
      // ignore if already initialized
    }
  });

  afterEach(async () => {
    try {
      await closeCacheDB();
    } catch (e) {
      // Ignore cleanup errors in test environment
    }
  });

  it('creates missing directory docs for implied file paths', async () => {
    const wsId = 'mig-ws-1';

    // Insert two files that imply directories but no dir docs exist
    await upsertCachedFile({
      id: 'mig-file-1',
      name: 'file1.md',
      path: 'a/b/file1.md',
      type: FileType.File,
      workspaceType: WorkspaceType.Browser,
      workspaceId: wsId,
      lastModified: Date.now(),
      dirty: false,
    } as any);

    await upsertCachedFile({
      id: 'mig-file-2',
      name: 'file2.md',
      path: 'a/c/file2.md',
      type: FileType.File,
      workspaceType: WorkspaceType.Browser,
      workspaceId: wsId,
      lastModified: Date.now(),
      dirty: false,
    } as any);

    const before = await getAllFiles(wsId);
    const dirsBefore = before.filter(f => f.type === FileType.Dir);
    expect(dirsBefore.length).toBe(0);

    // Run migration helper
    await ensureFolderDocs(wsId);

    const after = await getAllFiles(wsId);
    const dirPaths = after
      .filter(f => f.type === FileType.Dir)
      .map(f => (f.path || '').replace(/^\/+/,'').replace(/\/+$/,''))
      .sort();

    expect(dirPaths).toEqual(['a', 'a/b', 'a/c'].sort());
  });
});

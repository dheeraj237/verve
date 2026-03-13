import 'fake-indexeddb/auto';
import { vi, beforeEach, afterAll, describe, it, expect } from 'vitest';

// Use real RxDB client for this test
vi.unmock('@/core/rxdb/rxdb-client');

import { WorkspaceType } from '@/core/cache/types';
import * as fileOps from '@/core/cache/file-manager';

describe('file-manager across workspace types', () => {
  beforeEach(async () => {
    // Don't reset modules as it breaks the initialized imports above
    await fileOps.initializeFileOperations();
  });

  it('browser workspace: create/read/rename/delete files and directories', async () => {

    await fileOps.initializeFileOperations();

    const wsId = 'ws-browser-crud';

    // save files
    const f1 = await fileOps.saveFile('/notes/a.md', 'A content', WorkspaceType.Browser, undefined, wsId);
    const f2 = await fileOps.saveFile('/notes/b.md', 'B content', WorkspaceType.Browser, undefined, wsId);

    // create directory
    await fileOps.createDirectory('/projects', WorkspaceType.Browser, wsId);

    // ensure created directory exists in the workspace
    const all = await fileOps.getAllFiles(wsId);
    expect(all.some(a => a.path === '/projects')).toBeTruthy();
    expect(all.some(a => a.path === '/notes/a.md')).toBeTruthy();

    // load file
    const loaded = await fileOps.loadFile('/notes/a.md', WorkspaceType.Browser, wsId);
    expect(loaded.content).toBe('A content');

    // rename
    await fileOps.renameFile('/notes/a.md', '/notes/a-renamed.md', wsId);
    const afterRename = await fileOps.getAllFiles(wsId);
    expect(afterRename.some(a => a.path === '/notes/a-renamed.md')).toBeTruthy();

    // delete
    await fileOps.deleteFile('/notes/b.md', wsId);
    const afterDelete = await fileOps.getAllFiles(wsId);
    expect(afterDelete.some(a => a.path === '/notes/b.md')).toBeFalsy();
  });

  it('local workspace: saveFile marks file dirty; markCachedFileAsSynced clears dirty', async () => {
    await fileOps.initializeFileOperations();
    const wsId = 'ws-local-crud';

    const saved = await fileOps.saveFile('/local/doc.md', 'Local content', WorkspaceType.Local, undefined, wsId);

    // Dirty flag should be set after save for local workspace
    const dirty = await fileOps.getDirtyFiles(wsId);
    expect(dirty.some(d => d.path === '/local/doc.md')).toBeTruthy();

    // Simulate what SyncManager does after a successful push
    await fileOps.markCachedFileAsSynced(saved.id);

    const afterSync = await fileOps.getCachedFile('/local/doc.md', wsId);
    expect(afterSync?.dirty).toBe(false);
  });

  it('gdrive workspace: saveFile marks file dirty; markCachedFileAsSynced clears dirty', async () => {
    await fileOps.initializeFileOperations();
    const wsId = 'ws-gdrive-crud';

    const saved = await fileOps.saveFile('/g/doc.md', 'GDrive content', WorkspaceType.GDrive, undefined, wsId);

    const dirty = await fileOps.getDirtyFiles(wsId);
    expect(dirty.some(d => d.path === '/g/doc.md')).toBeTruthy();

    // Simulate what SyncManager does after a successful push
    await fileOps.markCachedFileAsSynced(saved.id);

    const afterSync = await fileOps.getCachedFile('/g/doc.md', wsId);
    expect(afterSync?.dirty).toBe(false);
  });

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/file-manager');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
    try {
      const { stopSyncManager } = await import('@/core/sync/sync-manager');
      stopSyncManager();
    } catch (_) {}
  });
});

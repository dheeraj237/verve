import 'fake-indexeddb/auto';

jest.setTimeout(10000);

describe('file-operations across workspace types', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('browser workspace: create/read/rename/delete files and directories', async () => {
    const { WorkspaceType } = require('@/core/cache/types');
    const fileOps = await import('@/core/cache/file-operations');

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

  it('local workspace: dirty flag set and enqueue triggers adapter push', async () => {
    const { WorkspaceType } = require('@/core/cache/types');
    const fileOps = await import('@/core/cache/file-operations');
    const { getSyncManager, stopSyncManager } = await import('@/core/sync/sync-manager');

    await fileOps.initializeFileOperations();

    const wsId = 'ws-local-crud';

    const saved = await fileOps.saveFile('/local/doc.md', 'Local content', WorkspaceType.Local, undefined, wsId);

    // dirty files should include the saved file
    const dirty = await fileOps.getDirtyFiles(wsId);
    expect(dirty.some(d => d.path === '/local/doc.md')).toBeTruthy();

    // register mock adapter and enqueue
    const mgr = getSyncManager();
    const pushMock = jest.fn(async () => true);
    mgr.registerAdapter({ name: 'local', push: pushMock, pull: async () => null, exists: async () => false, delete: async () => false } as any);

    await mgr.enqueueAndProcess(saved.id, saved.path, WorkspaceType.Local, wsId);
    // wait until file is marked synced via RxDB subscription
    const { observeCachedFiles } = await import('@/core/cache');
    await new Promise<void>((resolve) => {
      const sub: any = observeCachedFiles((files: any[]) => {
        const f = files.find(x => x.id === saved.id && x.workspaceId === wsId);
        if (f && f.dirty === false) {
          try { sub.unsubscribe(); } catch (_) { }
          resolve();
        }
      });
      setTimeout(() => { try { sub.unsubscribe(); } catch (_) { }; resolve(); }, 2000);
    });
    expect(pushMock).toHaveBeenCalled();

    stopSyncManager();
  });

  it('gdrive workspace: dirty flag and sync push via adapter', async () => {
    const { WorkspaceType } = require('@/core/cache/types');
    const fileOps = await import('@/core/cache/file-operations');
    const { getSyncManager, stopSyncManager } = await import('@/core/sync/sync-manager');

    await fileOps.initializeFileOperations();

    const wsId = 'ws-gdrive-crud';

    const saved = await fileOps.saveFile('/g/doc.md', 'GDrive content', WorkspaceType.GDrive, undefined, wsId);

    const dirty = await fileOps.getDirtyFiles(wsId);
    expect(dirty.some(d => d.path === '/g/doc.md')).toBeTruthy();

    const mgr = getSyncManager();
    const pushMock = jest.fn(async () => true);
    mgr.registerAdapter({ name: 'gdrive', push: pushMock, pull: async () => null, exists: async () => false, delete: async () => false } as any);

    await mgr.enqueueAndProcess(saved.id, saved.path, WorkspaceType.GDrive, wsId);
    const { observeCachedFiles } = await import('@/core/cache');
    await new Promise<void>((resolve) => {
      const sub: any = observeCachedFiles((files: any[]) => {
        const f = files.find(x => x.id === saved.id && x.workspaceId === wsId);
        if (f && f.dirty === false) {
          try { sub.unsubscribe(); } catch (_) { }
          resolve();
        }
      });
      setTimeout(() => { try { sub.unsubscribe(); } catch (_) { }; resolve(); }, 2000);
    });
    expect(pushMock).toHaveBeenCalled();

    stopSyncManager();
  });

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/rxdb');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
    try {
      const { stopSyncManager } = await import('@/core/sync/sync-manager');
      stopSyncManager();
    } catch (_) {}
  });
});

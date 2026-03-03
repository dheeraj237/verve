import 'fake-indexeddb/auto';

jest.setTimeout(10000);

describe('listFiles integration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('lists root files whether stored with or without leading slash', async () => {
    const fileOps = await import('@/core/cache/file-manager');
    const { WorkspaceType } = require('@/core/cache/types');

    await fileOps.initializeFileOperations();

    const wsId = 'ws-list-root';

    // Ensure a clean slate
    await fileOps.clearAllFiles();

    // Save one file without leading slash and one with leading slash
    await fileOps.saveFile('verve.md', '# Verve', WorkspaceType.Browser, undefined, wsId);
    await fileOps.saveFile('/top.md', 'top', WorkspaceType.Browser, undefined, wsId);

    const root = await fileOps.listFiles('', wsId);

    const names = root.map(r => r.name);
    expect(names).toContain('verve.md');
    expect(names).toContain('top.md');
  });

  afterAll(async () => {
    try {
      const { getCacheDB } = await import('@/core/cache/file-manager');
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
  });
});

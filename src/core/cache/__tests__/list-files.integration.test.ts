import 'fake-indexeddb/auto';
import { vi } from 'vitest';

describe('listFiles integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('lists root files whether stored with or without leading slash', async () => {
    const fileOps = await import('@/core/cache/file-manager');
    const { WorkspaceType } = await import('@/core/cache/types');

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

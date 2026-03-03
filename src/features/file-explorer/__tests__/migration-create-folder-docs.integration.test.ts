import { initializeFileOperations, saveFile, getAllFiles, ensureFolderDocs } from '@/core/cache/file-manager';

describe('migration: create missing folder docs', () => {
  beforeAll(async () => {
    await initializeFileOperations();
  });

  test('creates folder docs for implied directories', async () => {
    const ws = 'test-ws-migrate-folders';

    // Create files in nested paths without creating directories explicitly
    await saveFile('migrate/a/b/c.md', 'c', 'browser', {}, ws);
    await saveFile('migrate/a/d.md', 'd', 'browser', {}, ws);

    // Capture current entries (migration should be idempotent)
    let all = await getAllFiles(ws);

    // Run migration helper
    await ensureFolderDocs(ws);

    // Now directories should exist for 'migrate' and 'migrate/a'
    all = await getAllFiles(ws);
      const dirPaths = all.filter(f => f.type === 'directory').map(d => d.path.replace(/^\/*/, '').replace(/\/*$/, ''));

    expect(dirPaths).toEqual(expect.arrayContaining(['migrate', 'migrate/a']));
  });
});

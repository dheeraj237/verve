import 'fake-indexeddb/auto';

// initializeApp will be required after resetModules in tests to ensure module instance consistency
import { mockFetchForSamples, restoreFetchMock } from '@/tests/helpers/test-utils';
import { getCacheDB } from '@/core/cache/file-manager';
import * as fs from 'fs';
import * as path from 'path';

describe('initializeApp loads verve-samples on fresh start', () => {
  beforeEach(() => {
    jest.resetModules();
    // Ensure no pre-existing workspaces
    const { useWorkspaceStore } = require('@/core/store/workspace-store');
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: undefined });
    // Ensure fetch is mocked so browser-only loader can fetch sample files
    mockFetchForSamples();
  });

  afterAll(async () => {
    try {
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (_) {}
    restoreFetchMock();
  });

  it('creates verve-samples workspace and populates files from public/content', async () => {
    // Run initializeApp which should create workspace and load sample files
    const { initializeApp } = require('@/hooks/use-browser-mode');
    await initializeApp();

    const { getAllFiles, loadFile } = await import('@/core/cache/file-manager');
    const files = await getAllFiles('verve-samples');

    // Expect at least the known sample files to be present
    expect(files.length).toBeGreaterThanOrEqual(8);

    // Verify one sample file content matches the disk version
    const disk01 = fs.readFileSync(path.join(process.cwd(), 'public', 'content', '01-basic-formatting.md'), 'utf8');
    const loaded = await loadFile('/01-basic-formatting.md', 'browser', 'verve-samples');
    expect(loaded.content).toBe(disk01);
  });
});

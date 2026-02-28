import 'fake-indexeddb/auto';
import * as fs from 'fs';
import * as path from 'path';

import { initFileOps, destroyCacheDB } from '@/tests/helpers/test-utils';
import { WorkspaceType, FileType } from '@/core/cache/types';
import { useWorkspaceStore } from '@/core/store/workspace-store';

describe('fresh instance end-to-end', () => {
  beforeEach(async () => {
    jest.resetModules();

    // Initialize RxDB (uses fake-indexeddb in tests)
    await initFileOps();

    // Reset workspace store and create default workspace as a fresh app would
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: undefined });
    useWorkspaceStore.getState().createWorkspace('Verve Samples', WorkspaceType.Browser, { id: 'verve-samples' });

    // Load sample files from the local `public/content` folder into RxDB so tests
    // exercise the real cache layer (no network mocks).
    const sampleFiles = [
      { path: '/01-basic-formatting.md', name: '01-basic-formatting.md' },
      { path: '/02-lists-and-tasks.md', name: '02-lists-and-tasks.md' },
      { path: '/03-code-blocks.md', name: '03-code-blocks.md' },
      { path: '/04-tables-and-quotes.md', name: '04-tables-and-quotes.md' },
      { path: '/05-collapsable-sections.md', name: '05-collapsable-sections.md' },
      { path: '/06-mermaid-diagrams.md', name: '06-mermaid-diagrams.md' },
      { path: '/07-advanced-features.md', name: '07-advanced-features.md' },
      { path: '/08-link-navigation.md', name: '08-link-navigation.md' },
      { path: '/content1/test-feature-link-navigation.md', name: 'test-feature-link-navigation.md' },
      { path: '/notes-101/notes.md', name: 'notes.md' },
    ];

    const fileOps = await import('@/core/cache');

    for (const sample of sampleFiles) {
      // Resolve file on disk from the repository `public/content` folder
      const diskPath = path.join(process.cwd(), 'public', 'content', sample.path.startsWith('/') ? sample.path.slice(1) : sample.path);
      const content = fs.readFileSync(diskPath, 'utf8');
      const fileId = `verve-samples-${sample.path}`;

      await fileOps.upsertCachedFile({
        id: fileId,
        name: sample.name,
        path: sample.path,
        type: FileType.File,
        workspaceType: WorkspaceType.Browser,
        workspaceId: 'verve-samples',
        content,
        lastModified: Date.now(),
        dirty: false,
      });
    }
  });

  afterAll(async () => {
    await destroyCacheDB();
    try {
      // stop sync manager if started (best-effort)
      // eslint-disable-next-line global-require
      const { stopSyncManager } = require('@/core/sync/sync-manager');
      if (stopSyncManager) stopSyncManager();
    } catch (_) {
      // ignore
    }
  });

  it('creates default workspace and loads editable sample files', async () => {
    const store = useWorkspaceStore.getState();
    const ws = store.workspaces.find((w: any) => w.id === 'verve-samples');
    expect(ws).toBeDefined();
    expect(ws.name).toBe('Verve Samples');
    expect(ws.type).toBe(WorkspaceType.Browser);

    const { getAllFiles, loadFile, saveFile } = await import('@/core/cache/file-operations');

    const files = await getAllFiles('verve-samples');
    expect(files.length).toBe(10);

    // Verify a file loads with the expected content from disk
    const disk01 = fs.readFileSync(path.join(process.cwd(), 'public', 'content', '01-basic-formatting.md'), 'utf8');
    const loaded = await loadFile('/01-basic-formatting.md', WorkspaceType.Browser, 'verve-samples');
    expect(loaded.content).toBe(disk01);

    // Verify edits persist in the cache (file is editable)
    await saveFile('/01-basic-formatting.md', 'MODIFIED CONTENT', WorkspaceType.Browser, undefined, 'verve-samples');
    const after = await loadFile('/01-basic-formatting.md', WorkspaceType.Browser, 'verve-samples');
    expect(after.content).toBe('MODIFIED CONTENT');
  });
});

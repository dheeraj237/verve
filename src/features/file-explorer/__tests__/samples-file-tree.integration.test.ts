import 'fake-indexeddb/auto';
import * as fs from 'fs';
import * as path from 'path';

import { initFileOps, destroyCacheDB } from '@/tests/helpers/test-utils';
import { WorkspaceType, FileType } from '@/core/cache/types';
// We'll import stores dynamically after initializing RxDB to avoid module-instance mismatches

describe('file explorer samples tree', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initFileOps();

    // Import stores after RxDB init to ensure same module instances
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');
    const { useFileExplorerStore } = await import('@/features/file-explorer/store/file-explorer-store');

    // Ensure workspace exists
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: undefined });
    useWorkspaceStore.getState().createWorkspace('Verve Samples', WorkspaceType.Browser, { id: 'verve-samples' });

    // Populate RxDB with sample files from public/content
    const sampleFiles = [
      '/01-basic-formatting.md',
      '/02-lists-and-tasks.md',
      '/03-code-blocks.md',
      '/04-tables-and-quotes.md',
      '/05-collapsable-sections.md',
      '/06-mermaid-diagrams.md',
      '/07-advanced-features.md',
      '/08-link-navigation.md',
      '/content1/test-feature-link-navigation.md',
      '/notes-101/notes.md',
    ];

    const cache = await import('@/core/cache');
    for (const p of sampleFiles) {
      const diskPath = path.join(process.cwd(), 'public', 'content', p.startsWith('/') ? p.slice(1) : p);
      const content = fs.readFileSync(diskPath, 'utf8');
      await cache.upsertCachedFile({
        id: `verve-samples-${p}`,
        name: p.split('/').pop() as string,
        path: p,
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
  });

  it('refreshFileTree populates fileTree for verve-samples', async () => {
    const { useFileExplorerStore } = await import('@/features/file-explorer/store/file-explorer-store');
    const explorer = useFileExplorerStore.getState();
    await explorer.refreshFileTree();

    const state = useFileExplorerStore.getState();
    expect(state.fileTree.length).toBeGreaterThan(0);

    // Ensure a known file exists in the tree
    const flatten = (nodes: any[]): any[] => nodes.flatMap(n => n.children ? [n, ...flatten(n.children)] : [n]);
    const all = flatten(state.fileTree);
    const found = all.find(n => n.path === '/01-basic-formatting.md' || n.name === '01-basic-formatting.md');
    expect(found).toBeDefined();
  });
});

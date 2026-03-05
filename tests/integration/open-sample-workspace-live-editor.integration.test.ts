import 'fake-indexeddb/auto';
import { initFileOps, destroyCacheDB, mockFetchForSamples, restoreFetchMock, createWorkspace } from '@/tests/helpers/test-utils';
import { useFileExplorerStore } from '@/features/file-explorer/store/file-explorer-store';
import { useEditorStore } from '@/features/editor/store/editor-store';
import { WorkspaceType, FileType } from '@/core/cache/types';

describe('Open sample workspace file in live editor', () => {
  beforeEach(async () => {
    await initFileOps();
    mockFetchForSamples();
  });

  afterEach(async () => {
    try { await destroyCacheDB(); } catch (_) {}
    restoreFetchMock();
  });

  it('creates sample workspace, opens a file in editor and verifies content', async () => {
    await createWorkspace('Verve Samples', WorkspaceType.Browser, 'verve-samples');

    const explorer = useFileExplorerStore.getState();
    // Ensure samples are loaded into the cache
    await explorer.reloadSampleWorkspace();

    // Find a markdown file in the tree
    function findFirstMarkdown(nodes: any[]): any {
      for (const n of nodes) {
        if (n.type === FileType.File && n.name?.endsWith('.md')) return n;
        if (n.children && n.children.length) {
          const found = findFirstMarkdown(n.children);
          if (found) return found;
        }
      }
      return null;
    }

    const fileNode = findFirstMarkdown(explorer.getFileTree());
    expect(fileNode).toBeDefined();

    // Open via editor's path-based API (simulates user opening in live editor)
    await useEditorStore.getState().openFileByPath(fileNode.path);

    const editor = useEditorStore.getState();
    const opened = editor.openTabs.find(t => t.path === fileNode.path || t.name === fileNode.name);
    expect(opened).toBeDefined();

    // Load authoritative content from cache and compare
    const { loadFile } = await import('@/core/cache/file-manager');
    const loaded = await loadFile(fileNode.path, WorkspaceType.Browser, 'verve-samples');
    expect(loaded).toBeDefined();
    expect(loaded.content).toBeDefined();

    // Editor tab should reflect the loaded content
    expect(opened?.content).toBe(loaded.content);

    // No HTML artifacts should appear in sample markdown content
    expect(loaded.content).not.toMatch(/<\/?html/i);
    expect(loaded.content).not.toMatch(/<!DOCTYPE/i);
  }, 20000);
});

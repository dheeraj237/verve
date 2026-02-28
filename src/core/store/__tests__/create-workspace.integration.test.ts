import 'fake-indexeddb/auto';
import * as fs from 'fs';
import * as path from 'path';

import { initFileOps, destroyCacheDB } from '@/tests/helpers/test-utils';
import { WorkspaceType } from '@/core/cache/types';

describe('create workspace default file', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initFileOps();
  });

  afterAll(async () => {
    await destroyCacheDB();
  });

  it('creates a new browser workspace and writes verve.md into RxDB and file tree', async () => {
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');
    // ensure clean
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: undefined });

    // create new workspace
    useWorkspaceStore.getState().createWorkspace('My New WS', WorkspaceType.Browser, { id: 'new-ws' });

    // Wait for the background save to complete by subscribing to the RxDB document
    const { getCacheDB } = await import('@/core/cache/rxdb');
    const db = getCacheDB();

    const waitForFile = (timeoutMs = 3000) => new Promise<boolean>((resolve) => {
      const start = Date.now();
      const query = db.cached_files.findOne({ selector: { name: 'verve.md', workspaceId: 'new-ws' } });
      const sub = query.$.subscribe((doc: any) => {
        if (doc) {
          try { sub.unsubscribe(); } catch (_) { }
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          try { sub.unsubscribe(); } catch (_) { }
          resolve(false);
        }
      });
    });

    const found = await waitForFile(3000);
    expect(found).toBe(true);

    // ensure file-explorer store shows the file after refresh
    const { useFileExplorerStore } = await import('@/features/file-explorer/store/file-explorer-store');
    const explorer = useFileExplorerStore.getState();
    await explorer.refreshFileTree();

    const state = useFileExplorerStore.getState();
    const flatten = (nodes: any[]): any[] => nodes.flatMap(n => n.children ? [n, ...flatten(n.children)] : [n]);
    const all = flatten(state.fileTree);
    const node = all.find(n => n.name === 'verve.md' || n.path === 'verve.md' || n.path === '/verve.md');
    expect(node).toBeDefined();
  });
});

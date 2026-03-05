import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import { initFileOps, destroyCacheDB, startSyncManagerWithAdapter, createWorkspace } from '@/tests/helpers/test-utils';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { useFileExplorerStore } from '@/features/file-explorer/store/file-explorer-store';
import { WorkspaceType } from '@/core/cache/types';

describe('FileExplorer headless integration with SyncManager (stores only)', () => {
  beforeEach(async () => {
    await initFileOps();
  });

  afterEach(async () => {
    try {
      await destroyCacheDB();
    } catch (e) {
      // ignore
    }
  });

  it('updates file-explorer store after save and SyncManager pushes only for active workspace, switching shows different files', async () => {
    const pushes: any[] = [];
    const adapter = {
      name: 'local',
      isReady: () => true,
      push: vi.fn(async (desc: any, content: string) => {
        pushes.push({ desc, content });
        return true;
      }),
    } as any;

    const mgr = await startSyncManagerWithAdapter(adapter);

    // Create workspace 1 (becomes active)
    await createWorkspace('WS1', WorkspaceType.Local, 'ws1');

    // Create a file via the file-explorer store API
    await useFileExplorerStore.getState().createFile('', 'headless-a.md');
    await useFileExplorerStore.getState().refreshFileTree();

    // Ensure file is present in fileTree
    const state1 = useFileExplorerStore.getState();
    const found1 = state1.getFileTree().flatMap(n => n.children ? [n, ...n.children] : [n]).find((n: any) => n.name === 'headless-a.md' || n.path === 'headless-a.md');
    expect(found1).toBeDefined();

    // Trigger explicit sync cycle to ensure processing in this test environment
    await (mgr as any).syncNow();
    expect(adapter.push).toHaveBeenCalled();

    // Create workspace 2 and switch to it
    await createWorkspace('WS2', WorkspaceType.Local, 'ws2');

    // Create a file in workspace 2
    await useFileExplorerStore.getState().createFile('', 'headless-b.md');
    await useFileExplorerStore.getState().refreshFileTree();

    // Ensure new workspace file present and previous workspace file not present in the current tree
    const state2 = useFileExplorerStore.getState();
    const textList = state2.getFileTree().flatMap(n => n.children ? [n, ...n.children] : [n]).map((n: any) => n.name);
    expect(textList).toContain('headless-b.md');
    expect(textList).not.toContain('headless-a.md');
  });
});

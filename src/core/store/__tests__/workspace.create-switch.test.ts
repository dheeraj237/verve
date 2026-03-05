import { vi, beforeEach, describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';

// Use real RxDB client for this test
vi.unmock('@/core/rxdb/rxdb-client');

import { useWorkspaceStore } from '@/core/store/workspace-store';
import { useEditorStore } from '@/features/editor/store/editor-store';
import { WorkspaceType } from '@/core/cache/types';
import * as fileOps from '@/core/cache/file-manager';

describe('workspace create & switch integration', () => {
  beforeEach(async () => {
    // Don't reset modules as it breaks the initialized imports
    await fileOps.initializeFileOperations();
  });

  it('creating workspaces and switching restores workspace-specific tabs and hierarchy', async () => {

    await fileOps.initializeFileOperations();

    // Start clean
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null, tabsByWorkspace: {} });

    // Create workspace A and B via the public API
    useWorkspaceStore.getState().createWorkspace('Workspace A', WorkspaceType.Browser, { id: 'ws-A' });
    useWorkspaceStore.getState().createWorkspace('Workspace B', WorkspaceType.Browser, { id: 'ws-B' });

    // Switch to ws-A so editor state belongs to ws-A
    await useWorkspaceStore.getState().switchWorkspace('ws-A');

    // Save nested files into ws-A
    const f1 = await fileOps.saveFile('/notes/intro.md', 'Intro content', WorkspaceType.Browser, undefined, 'ws-A');
    const f2 = await fileOps.saveFile('/notes/guide/setup.md', 'Setup content', WorkspaceType.Browser, undefined, 'ws-A');

    // Simulate editor having opened these tabs while in ws-A
    useEditorStore.setState({
      openTabs: [
        { id: f1.id, path: f1.path, name: f1.name, content: f1.content },
        { id: f2.id, path: f2.path, name: f2.name, content: f2.content },
      ],
      activeTabId: f1.id,
    });

    // Persist tabs for ws-A
    useWorkspaceStore.getState().saveTabsForWorkspace('ws-A');

    // Switch to ws-B -> should clear editor tabs
    await useWorkspaceStore.getState().switchWorkspace('ws-B');
    expect(useEditorStore.getState().openTabs.length).toBe(0);

    // Switch back to ws-A -> tabs should be restored with correct content
    await useWorkspaceStore.getState().switchWorkspace('ws-A');
    const tabs = useEditorStore.getState().openTabs;
    const paths = tabs.map((t: any) => t.path).sort();
    expect(paths).toEqual(['/notes/guide/setup.md', '/notes/intro.md'].sort());
    const intro = tabs.find((t: any) => t.path === '/notes/intro.md');
    expect(intro?.content).toBe('Intro content');
  });
});

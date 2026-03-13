import { vi } from 'vitest';

vi.mock('@/core/cache/file-manager', () => ({
  initializeFileOperations: vi.fn(),
  loadFile: vi.fn(),
  saveFile: vi.fn(() => Promise.resolve({ id: 'file-1', name: 'doc', path: '/doc.md', content: 'new content' })),
  listFiles: vi.fn(),
}));

vi.mock('@/core/sync/sync-manager', () => ({
  getSyncManager: () => ({}),
  stopSyncManager: vi.fn(),
}));

vi.mock('@/core/config/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

import { useEditorStore } from '../editor-store';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { saveFile } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';

describe('applyEditorPatch sync behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-1', name: 'WS', type: WorkspaceType.Local, createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() }], activeWorkspaceId: 'ws-1' });

    useEditorStore.setState({ openTabs: [{ id: 'file-1', path: '/doc.md', name: 'doc', content: 'old', isLocal: true }], activeTabId: 'file-1' });
  });

  it('calls saveFile with correct path and content for active workspace', async () => {
    const apply = useEditorStore.getState().applyEditorPatch;

    await apply('file-1', 'new content');

    // Allow promise microtasks to run
    await new Promise((r) => setTimeout(r, 0));

    expect(saveFile).toHaveBeenCalledWith('/doc.md', 'new content', expect.any(String), undefined, 'ws-1');
  });
});

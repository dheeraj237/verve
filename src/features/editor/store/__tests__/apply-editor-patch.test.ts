import { jest } from '@jest/globals';

const saveFileMock = jest.fn().mockResolvedValue({ id: 'file-1', name: 'doc', path: '/doc.md', content: 'new content' });
jest.mock('@/core/cache/file-operations', () => ({
  initializeFileOperations: jest.fn(),
  loadFile: jest.fn(),
  saveFile: saveFileMock,
  listFiles: jest.fn(),
}));

const enqueueMock = jest.fn();
jest.mock('@/core/sync/sync-manager', () => ({
  getSyncManager: () => ({ enqueueAndProcess: enqueueMock }),
}));

const isFeatureEnabledMock = jest.fn(() => true);
jest.mock('@/core/config/features', () => ({ isFeatureEnabled: isFeatureEnabledMock }));

import { useEditorStore } from '../editor-store';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { saveFile } from '@/core/cache/file-operations';
import { getSyncManager } from '@/core/sync/sync-manager';

describe('applyEditorPatch sync behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up workspace store with active workspace
    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-1', name: 'WS', type: 'local' }], activeWorkspaceId: 'ws-1' });

    // Set editor open tabs
    useEditorStore.setState({ openTabs: [{ id: 'file-1', path: '/doc.md', name: 'doc', content: 'old' }], activeTabId: 'file-1' });
  });

  it('enqueues and processes saved file for active workspace', async () => {
    const apply = useEditorStore.getState().applyEditorPatch;

    await apply('file-1', 'new content');

    // Allow promise microtasks to run
    await new Promise((r) => setTimeout(r, 0));

    expect(saveFileMock).toHaveBeenCalledWith('/doc.md', 'new content', expect.any(String), undefined, 'ws-1');
    expect(enqueueMock).toHaveBeenCalledWith('file-1', '/doc.md', expect.any(String), 'ws-1');
  });
});

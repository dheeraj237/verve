import { SyncManager } from '@/core/sync/sync-manager';
import { WorkspaceType } from '@/core/cache/types';
import { useWorkspaceStore } from '@/core/store/workspace-store';

jest.mock('@/core/cache/rxdb', () => ({
  getCachedFile: jest.fn(),
  markCachedFileAsSynced: jest.fn(),
  upsertCachedFile: jest.fn(),
}));

jest.mock('@/core/cache/file-operations', () => ({
  loadFile: jest.fn(),
  saveFile: jest.fn(),
}));

import { getCachedFile } from '@/core/cache/rxdb';
import { loadFile } from '@/core/cache/file-operations';

describe('SyncManager pull for active workspace only', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls adapter.pull when file belongs to the active workspace', async () => {
    const manager = new SyncManager();

    const adapter = { name: 'gdrive', push: jest.fn().mockResolvedValue(true), pull: jest.fn().mockResolvedValue('remote') } as any;
    manager.registerAdapter(adapter);

    (getCachedFile as jest.Mock).mockResolvedValue({ id: 'f1', path: '/f1.md', workspaceType: 'gdrive', workspaceId: 'ws-active' });
    (loadFile as jest.Mock).mockResolvedValue({ content: 'local content' });

    // Mock active workspace to match file.workspaceId
    jest.spyOn(useWorkspaceStore, 'getState').mockReturnValue({ activeWorkspace: () => ({ id: 'ws-active', type: WorkspaceType.GDrive }) } as any);

    // Enable pulls for this manager instance
    (manager as any).pullAfterPush = true;

    await manager.enqueueAndProcess('f1', '/f1.md', 'gdrive', 'ws-active');

    expect(adapter.pull).toHaveBeenCalledWith('f1');
  });

  it('does not call adapter.pull when file is from a different workspace', async () => {
    const manager = new SyncManager();

    const adapter = { name: 'gdrive', push: jest.fn().mockResolvedValue(true), pull: jest.fn().mockResolvedValue('remote') } as any;
    manager.registerAdapter(adapter);

    (getCachedFile as jest.Mock).mockResolvedValue({ id: 'f2', path: '/f2.md', workspaceType: 'gdrive', workspaceId: 'ws-other' });
    (loadFile as jest.Mock).mockResolvedValue({ content: 'local content' });

    // Active workspace is different
    jest.spyOn(useWorkspaceStore, 'getState').mockReturnValue({ activeWorkspace: () => ({ id: 'ws-active', type: WorkspaceType.GDrive }) } as any);

    (manager as any).pullAfterPush = true;

    await manager.enqueueAndProcess('f2', '/f2.md', 'gdrive', 'ws-other');

    expect(adapter.pull).not.toHaveBeenCalled();
  });
});

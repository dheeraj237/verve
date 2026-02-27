import { SyncManager } from '@/core/sync/sync-manager';

jest.mock('@/core/cache/rxdb', () => ({
  upsertCachedFile: jest.fn(),
}));

jest.mock('@/core/cache/file-operations', () => ({
  saveFile: jest.fn(),
}));

import { upsertCachedFile } from '@/core/cache/rxdb';
import { saveFile } from '@/core/cache/file-operations';
import { WorkspaceType } from '@/core/cache/types';

describe('SyncManager workspace-type adapters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('uses local adapter when workspace type is Local and saves files', async () => {
    const manager = new SyncManager();

    const adapter = {
      name: 'local',
      pullWorkspace: async (workspaceId: string) => {
        return [ { fileId: 'l1', content: 'local-one' } ];
      },
    } as any;

    manager.registerAdapter(adapter);

    const workspace = { id: 'ws-local', type: WorkspaceType.Local, path: '/', createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() } as any;

    await manager.pullWorkspace(workspace);

    expect(upsertCachedFile).toHaveBeenCalledTimes(1);
    expect(saveFile).toHaveBeenCalledWith('l1', 'local-one', workspace.type, undefined, workspace.id);
  });

  it('does nothing for browser workspace (no adapter usage)', async () => {
    const manager = new SyncManager();

    const workspace = { id: 'ws-browser', type: WorkspaceType.Browser, path: '/', createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() } as any;

    await manager.pullWorkspace(workspace);

    expect(upsertCachedFile).not.toHaveBeenCalled();
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('maps Drive workspace type to gdrive adapter and uses pullWorkspace', async () => {
    const manager = new SyncManager();

    const adapter = {
      name: 'gdrive',
      pullWorkspace: async (workspaceId: string) => {
        return [ { fileId: 'g1', content: 'drive-one' } ];
      },
    } as any;

    manager.registerAdapter(adapter);

    // Test using WorkspaceType.GDrive
    const workspaceG = { id: 'ws-g', type: WorkspaceType.GDrive, path: '/', createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() } as any;
    await manager.pullWorkspace(workspaceG);
    expect(upsertCachedFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1' }));

    jest.resetAllMocks();

    // Test using literal 'drive' (older code path) maps to gdrive adapter
    const workspaceDrive = { id: 'ws-drive', type: 'drive', path: '/', createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() } as any;
    await manager.pullWorkspace(workspaceDrive);
    expect(upsertCachedFile).toHaveBeenCalled();
  });
});

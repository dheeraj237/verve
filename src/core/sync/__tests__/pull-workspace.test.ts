import { SyncManager } from '@/core/sync/sync-manager';

jest.mock('@/core/cache/rxdb', () => ({
  upsertCachedFile: jest.fn(),
}));

jest.mock('@/core/cache/file-operations', () => ({
  saveFile: jest.fn(),
}));

import { upsertCachedFile } from '@/core/cache/rxdb';
import { saveFile } from '@/core/cache/file-operations';

describe('SyncManager.pullWorkspace', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('uses adapter.pullWorkspace when available and saves files', async () => {
    const manager = new SyncManager();

    const adapter = {
      name: 'gdrive',
      pullWorkspace: async (workspaceId: string) => {
        return [
          { fileId: 'f1', content: 'one' },
          { fileId: 'f2', content: 'two' },
        ];
    },
    } as any;

    manager.registerAdapter(adapter);

    const workspace = { id: 'ws-1', type: 'gdrive', path: '/' } as any;

    await manager.pullWorkspace(workspace);

    expect(upsertCachedFile).toHaveBeenCalledTimes(2);
    expect(saveFile).toHaveBeenCalledTimes(2);
    expect(upsertCachedFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }));
    expect(saveFile).toHaveBeenCalledWith('f1', 'one', workspace.type, undefined, workspace.id);
  });

  it('falls back to listWorkspaceFiles + pull when pullWorkspace missing', async () => {
    const manager = new SyncManager();

    const adapter = {
      name: 'gdrive',
      listWorkspaceFiles: async (workspaceId: string) => {
        return [ { id: 'a1', path: '/a1.md' } ];
      },
      pull: async (fileId: string) => {
        if (fileId === 'a1') return 'alpha';
        return null;
      }
    } as any;

    manager.registerAdapter(adapter);

    const workspace = { id: 'ws-2', type: 'gdrive', path: '/' } as any;

    await manager.pullWorkspace(workspace);

    expect(upsertCachedFile).toHaveBeenCalledTimes(1);
    expect(saveFile).toHaveBeenCalledWith('/a1.md', 'alpha', workspace.type, undefined, workspace.id);
  });
});

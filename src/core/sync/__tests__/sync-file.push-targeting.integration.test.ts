import { SyncManager } from '@/core/sync/sync-manager';

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

describe('SyncManager push targeting', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('pushes only to adapter matching the file workspace type', async () => {
    const manager = new SyncManager();

    const adapterG = { name: 'gdrive', push: jest.fn().mockResolvedValue(true), pull: jest.fn() } as any;
    const adapterLocal = { name: 'local', push: jest.fn().mockResolvedValue(true), pull: jest.fn() } as any;

    manager.registerAdapter(adapterG);
    manager.registerAdapter(adapterLocal);

    (getCachedFile as jest.Mock).mockResolvedValue({ id: 'f1', path: '/f1.md', workspaceType: 'gdrive', workspaceId: 'ws1' });
    (loadFile as jest.Mock).mockResolvedValue({ content: 'local content' });

    await manager.enqueueAndProcess('f1', '/f1.md', 'gdrive', 'ws1');

    expect(adapterG.push).toHaveBeenCalled();
    expect(adapterLocal.push).not.toHaveBeenCalled();
  });
});

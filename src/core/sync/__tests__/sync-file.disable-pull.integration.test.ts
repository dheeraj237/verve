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

describe('SyncManager syncFile behavior (disable pull-after-push flag)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('does not call adapter.pull after a successful push when pullAfterPush is false', async () => {
    const manager = new SyncManager();

    const adapterA = {
      name: 'gdrive',
      push: jest.fn().mockResolvedValue(true),
      pull: jest.fn().mockResolvedValue('remote content A'),
    } as any;

    const adapterB = {
      name: 'local',
      push: jest.fn().mockResolvedValue(false),
      pull: jest.fn().mockResolvedValue('remote content B'),
    } as any;

    manager.registerAdapter(adapterA);
    manager.registerAdapter(adapterB);

    // Mock cache/file operations
    (getCachedFile as jest.Mock).mockResolvedValue({ id: 'f1', path: '/f1.md', workspaceType: 'gdrive', workspaceId: 'ws1' });
    (loadFile as jest.Mock).mockResolvedValue({ content: 'local content' });

    // Enqueue and process should call into syncFile which will push but not pull
    await manager.enqueueAndProcess('f1', '/f1.md', 'gdrive', 'ws1');

    expect(adapterA.push).toHaveBeenCalled();
    // Pulls must be skipped when flag is false
    expect(adapterA.pull).not.toHaveBeenCalled();
    expect(adapterB.pull).not.toHaveBeenCalled();
  });
});

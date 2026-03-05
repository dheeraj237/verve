import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { SyncManager } from '@/core/sync/sync-manager';

vi.mock('@/core/cache/file-manager', () => ({
  getCachedFile: vi.fn(),
  markCachedFileAsSynced: vi.fn(),
  upsertCachedFile: vi.fn(),
  loadFile: vi.fn(),
  saveFile: vi.fn(),
}));

import { getCachedFile, loadFile } from '@/core/cache/file-manager';

describe('SyncManager push targeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushes only to adapter matching the file workspace type', async () => {
    const manager = new SyncManager();

    const adapterG = { name: 'gdrive', push: vi.fn().mockResolvedValue(true), pull: vi.fn() } as any;
    const adapterLocal = { name: 'local', push: vi.fn().mockResolvedValue(true), pull: vi.fn() } as any;

    manager.registerAdapter(adapterG);
    manager.registerAdapter(adapterLocal);

    (getCachedFile as Mock).mockResolvedValue({ id: 'f1', path: '/f1.md', workspaceType: 'gdrive', workspaceId: 'ws1' });
    (loadFile as Mock).mockResolvedValue({ content: 'local content' });

    await manager.enqueueAndProcess('f1', '/f1.md', 'gdrive', 'ws1');

    expect(adapterG.push).toHaveBeenCalled();
    expect(adapterLocal.push).not.toHaveBeenCalled();
  });
});

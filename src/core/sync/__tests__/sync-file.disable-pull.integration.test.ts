import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Mock } from 'vitest';
import { SyncManager } from '@/core/sync/sync-manager';

vi.mock('@/core/cache/file-manager', () => ({
  getCachedFile: vi.fn(),
  markCachedFileAsSynced: vi.fn(),
  upsertCachedFile: vi.fn(),
  loadFile: vi.fn(),
  saveFile: vi.fn(),
}));

import { getCachedFile, loadFile } from '@/core/cache/file-manager';

describe('SyncManager syncFile behavior (disable pull-after-push flag)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call adapter.pull after a successful push when pullAfterPush is false', async () => {
    const manager = new SyncManager();

    const adapterA = {
      name: 'gdrive',
      push: vi.fn().mockResolvedValue(true),
      pull: vi.fn().mockResolvedValue('remote content A'),
    } as any;

    const adapterB = {
      name: 'local',
      push: vi.fn().mockResolvedValue(false),
      pull: vi.fn().mockResolvedValue('remote content B'),
    } as any;

    manager.registerAdapter(adapterA);
    manager.registerAdapter(adapterB);

    // Mock cache/file operations
    (getCachedFile as Mock).mockResolvedValue({ id: 'f1', path: '/f1.md', workspaceType: 'gdrive', workspaceId: 'ws1' });
    (loadFile as Mock).mockResolvedValue({ content: 'local content' });

    // Enqueue and process should call into syncFile which will push but not pull
    await manager.enqueueAndProcess('f1', '/f1.md', 'gdrive', 'ws1');

    expect(adapterA.push).toHaveBeenCalled();
    // Pulls must be skipped when flag is false
    expect(adapterA.pull).not.toHaveBeenCalled();
    expect(adapterB.pull).not.toHaveBeenCalled();
  });
});

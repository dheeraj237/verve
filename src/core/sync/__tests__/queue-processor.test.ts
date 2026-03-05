import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { processPendingQueueOnce } from '@/core/sync/sync-queue-processor';

vi.mock('@/core/cache/file-manager', () => ({
  getCacheDB: vi.fn(),
  getCachedFile: vi.fn(),
  markCachedFileAsSynced: vi.fn(),
}));

import { getCacheDB, getCachedFile, markCachedFileAsSynced } from '@/core/cache/file-manager';
import type { ISyncAdapter } from '@/core/sync/adapter-types';
import { SyncOp } from '@/core/cache/types';

describe('sync-queue-processor', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('processes put entry successfully and removes it', async () => {
    const entry = {
      id: 'e1',
      op: SyncOp.Put,
      target: 'file',
      targetId: 'file-1',
      attempts: 0,
      createdAt: Date.now(),
    };

    const remove = vi.fn(async () => { });
    const patch = vi.fn(async () => { });

    const doc = {
      toJSON: () => entry,
      remove,
      patch,
    };

    // Mock DB to return the one queue doc
    (getCacheDB as Mock).mockReturnValue({
      sync_queue: {
        find: () => ({ sort: () => ({ exec: async () => [doc] }) }),
      },
    });

    // Mock cached file resolution
    (getCachedFile as Mock).mockResolvedValue({ id: 'file-1', path: '/f.md', content: 'hi' });

    const calls: any[] = [];
    const mockAdapter: ISyncAdapter = {
      name: 'mock',
      push: async (file: any, content: string) => {
        calls.push({ file, content });
        return true;
      },
      pull: async () => null,
    };

    const adapters = new Map<string, ISyncAdapter>([[mockAdapter.name, mockAdapter]]);

    await processPendingQueueOnce(adapters, 3);

    expect(calls.length).toBe(1);
    expect(remove).toHaveBeenCalled();
    expect(markCachedFileAsSynced).toHaveBeenCalledWith('file-1');
  });

  test('increments attempts on failure', async () => {
    const entry = {
      id: 'e2',
      op: SyncOp.Put,
      target: 'file',
      targetId: 'file-2',
      attempts: 0,
      createdAt: Date.now(),
    };

    const remove = vi.fn(async () => { });
    const patch = vi.fn(async () => { });

    const doc = {
      toJSON: () => entry,
      remove,
      patch,
    };

    (getCacheDB as Mock).mockReturnValue({
      sync_queue: {
        find: () => ({ sort: () => ({ exec: async () => [doc] }) }),
      },
    });

    (getCachedFile as Mock).mockResolvedValue({ id: 'file-2', path: '/f2.md', content: 'bye' });

    const mockAdapter: ISyncAdapter = {
      name: 'mock',
      push: async () => false, // fails
      pull: async () => null,
    };

    const adapters = new Map<string, ISyncAdapter>([[mockAdapter.name, mockAdapter]]);

    await processPendingQueueOnce(adapters, 3);

    expect(patch).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  test('handles delete operation', async () => {
    const entry = {
      id: 'e3',
      op: SyncOp.Delete,
      target: 'file',
      targetId: 'file-3',
      attempts: 0,
      createdAt: Date.now(),
    };

    const remove = vi.fn(async () => { });
    const patch = vi.fn(async () => { });

    const doc = {
      toJSON: () => entry,
      remove,
      patch,
    };

    (getCacheDB as Mock).mockReturnValue({
      sync_queue: {
        find: () => ({ sort: () => ({ exec: async () => [doc] }) }),
      },
    });

    const mockAdapter: ISyncAdapter = {
      name: 'mock',
      push: async () => false,
      pull: async () => null,
      delete: async (_id: string) => true,
    };

    const adapters = new Map<string, ISyncAdapter>([[mockAdapter.name, mockAdapter]]);

    await processPendingQueueOnce(adapters, 3);

    expect(remove).toHaveBeenCalled();
  });
});

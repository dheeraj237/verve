import 'fake-indexeddb/auto';

import { initializeFileOperations } from '@/core/cache/file-manager';
import { getSyncManager } from '@/core/sync/sync-manager';
import type { ISyncAdapter } from '@/core/sync/adapter-types';
import { upsertCachedFile } from '@/core/cache/rxdb';
import { saveFile } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';
import { openLocalDirectory } from '@/features/file-explorer/store/helpers/directory-handler';

describe('directory-handler integration', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initializeFileOperations();
  });

  afterEach(() => {
    try { getSyncManager().stop(); } catch (_) {}
  });

  test('openLocalDirectory delegates to local adapter and builds file tree from RxDB', async () => {
    const mgr = getSyncManager();

    const mockAdapter: Partial<ISyncAdapter> & { name: string } = {
      name: 'local',
      openDirectoryPicker: async (workspaceId?: string) => {
        // Simulate adapter scanning and upserting a file into RxDB
        const id = 'foo.md';
        await upsertCachedFile({ id, name: 'foo.md', path: 'foo.md', type: 'file', workspaceType: WorkspaceType.Local, workspaceId: workspaceId, content: 'hello', lastModified: Date.now(), dirty: false } as any);
        await saveFile('foo.md', 'hello', WorkspaceType.Local, undefined, workspaceId);
        return;
      },
    } as any;

    mgr.registerAdapter(mockAdapter as any);

    const res = await openLocalDirectory('ws-test');
    expect(res).toBeDefined();
    expect(Array.isArray(res.fileTree)).toBe(true);
    const found = res.fileTree.find((n) => n.name === 'foo.md' || n.path === 'foo.md');
    expect(found).toBeDefined();
  });
});

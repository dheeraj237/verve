import 'fake-indexeddb/auto';

import { initializeRxDB, getCacheDB, closeCacheDB } from '@/core/cache/file-manager';
import { getSyncManager, stopSyncManager } from '@/core/sync/sync-manager';
import { getAllFiles } from '@/core/cache/file-manager';
import { getCachedFile } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';

describe('SyncManager.pullWorkspace with adapters missing expected methods (local adapter mismatch)', () => {
  beforeAll(async () => {
    await initializeRxDB();
  });

  afterAll(async () => {
    try {
      await closeCacheDB();
    } catch (_) {}
    try {
      stopSyncManager();
    } catch (_) {}
  });

  test('adapters without `listWorkspaceFiles` are ignored by pullWorkspace; replacing with adapter that implements the contract upserts files', async () => {
    const mgr = getSyncManager();

    // Broken adapter: exposes `listFiles` but NOT `listWorkspaceFiles` (simulates old local adapter)
    const brokenAdapter = {
      name: 'local',
      listFiles: async (_dir = '') => [{ id: '/f1.md', path: '/f1.md', name: 'f1.md' }],
      pull: async (_id: string) => 'broken-content',
    } as any;

    // Register broken adapter
    mgr.registerAdapter(brokenAdapter);

    // Attempt to pull workspace - should be a no-op because SyncManager looks for listWorkspaceFiles/pullWorkspace
    await mgr.pullWorkspace({ id: 'ws-local', type: WorkspaceType.Local });

    let files = await getAllFiles('ws-local');
    expect(files.length).toBe(0);

    // Fixed adapter: implements listWorkspaceFiles + pull
    const fixedAdapter = {
      name: 'local',
      listWorkspaceFiles: async (_workspaceId?: string, _path?: string) => [{ id: '/f1.md', path: '/f1.md', metadata: { name: 'f1.md' } }],
      pull: async (_id: string) => 'fixed-content',
    } as any;

    // Replace registered adapter with fixed implementation
    mgr.registerAdapter(fixedAdapter);

    // Pull again - should upsert into RxDB
    await mgr.pullWorkspace({ id: 'ws-local', type: WorkspaceType.Local });

    files = await getAllFiles('ws-local');
    expect(files.length).toBeGreaterThan(0);

    const cached = await getCachedFile('/f1.md', 'ws-local');
    expect(cached).toBeDefined();
    // Content is saved via saveFile during pullWorkspace; ensure it's present
    expect((await getCachedFile('/f1.md', 'ws-local'))?.content).toBe('fixed-content');
  });
});

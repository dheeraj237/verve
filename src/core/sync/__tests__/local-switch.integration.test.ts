import 'fake-indexeddb/auto';
import { vi } from 'vitest';

import { initializeFileOperations } from '@/core/cache/file-manager';
import { getSyncManager, initializeSyncManager } from '@/core/sync/sync-manager';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';
import { useWorkspaceStore } from '@/core/store/workspace-store';

/**
 * Ensures switching to a Local workspace does not throw when the LocalAdapter
 * has not been initialized with a directory handle (window.__localDirHandle).
 */

describe('Local workspace switch (uninitialized LocalAdapter)', () => {
  beforeEach(async () => {
    vi.resetModules();
    // init RxDB
    await initializeFileOperations();

    // reset workspace store
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: undefined });

    // register adapters but do not initialize LocalAdapter with a handle
    const mgr = getSyncManager();
    mgr.registerAdapter(new LocalAdapter());
    mgr.start();
  });

  afterAll(() => {
    try {
      const mgr = getSyncManager();
      mgr.stop();
    } catch (_) {}
  });

  it('switching to local workspace should not throw even when local dir is missing', async () => {
    // create a Local workspace
    useWorkspaceStore.getState().createWorkspace('Local Test', 'local' as any, { id: 'local-test' });

    // Try switching to it; previously this caused an error from LocalAdapter.ensureInitialized
    await expect(useWorkspaceStore.getState().switchWorkspace('local-test')).resolves.toBeUndefined();

    const active = useWorkspaceStore.getState().activeWorkspace();
    expect(active).toBeDefined();
    expect(active?.id).toBe('local-test');
  });
});

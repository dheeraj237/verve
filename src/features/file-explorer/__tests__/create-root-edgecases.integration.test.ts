import 'fake-indexeddb/auto';

import { initFileOps, destroyCacheDB } from '@/tests/helpers/test-utils';
import { WorkspaceType, FileType } from '@/core/cache/types';

describe('create in root edge cases across workspace types', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initFileOps();
  });

  afterAll(async () => {
    await destroyCacheDB();
  });

  const workspaceTypes = [WorkspaceType.Browser, WorkspaceType.Local, WorkspaceType.Drive];

  for (const wsType of workspaceTypes) {
    it(`creates file and folder in root for workspace type=${wsType}`, async () => {
      const { useWorkspaceStore } = await import('@/core/store/workspace-store');
      const { useFileExplorerStore } = await import('@/features/file-explorer/store/file-explorer-store');
      const fileOps = await import('@/core/cache/file-manager');
      const cache = await import('@/core/cache');

      // Create workspace and ensure it's active
      const wsId = `${wsType}-root-test`;
      useWorkspaceStore.getState().createWorkspace(`test-${wsType}`, wsType as any, { id: wsId });

      // Create file in root
      await useFileExplorerStore.getState().createFile('', 'root-new.md');

      // load via file-manager to validate content is empty string
      const loaded = await fileOps.loadFile('root-new.md', wsType, wsId);
      expect(loaded).toBeDefined();
      expect(loaded.content).toBe('');

      // Also ensure we didn't accidentally save HTML into the cache
      const created = await cache.getCachedFile('root-new.md', wsId);
      expect(created).toBeDefined();
      expect((created?.content || '')).not.toMatch(/<\/?html/i);

      // Create folder in root
      await useFileExplorerStore.getState().createFolder('', 'root-folder');

      // Verify folder metadata exists in cache and is a directory
      const folderCached = await cache.getCachedFile('root-folder', wsId);
      expect(folderCached).toBeDefined();
      expect(folderCached!.type).toBe(FileType.Dir);
    });
  }
});

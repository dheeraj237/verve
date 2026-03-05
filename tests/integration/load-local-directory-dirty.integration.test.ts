import 'fake-indexeddb/auto';
import { vi } from 'vitest';

import { initializeRxDB, closeCacheDB, getDirtyFiles, getAllFiles } from '@/core/cache';
import { upsertCachedFile } from '@/core/cache/file-manager';
import { getSyncManager } from '@/core/sync/sync-manager';
import type { ISyncAdapter } from '@/core/sync/adapter-types';
import { WorkspaceType } from '@/core/cache/types';
import { FileType } from '@/shared/types';

describe('Integration: load local directory shows files as dirty', () => {
  beforeEach(async () => {
    vi.resetModules();
    await initializeRxDB();
  });

  afterEach(async () => {
    try {
      getSyncManager().stop();
    } catch (_) {}
    try {
      await closeCacheDB();
    } catch (_) {}
  });

  it('should not mark files as dirty when loading a local directory', async () => {
    const workspaceId = 'test-local-ws';
    const mgr = getSyncManager();

    // Create a mock local adapter that simulates scanning a directory with files
    const mockAdapter: Partial<ISyncAdapter> & { name: string } = {
      name: 'local',
      openDirectoryPicker: async (wsId?: string) => {
        // Simulate scanner upserting files into RxDB
        // This simulates what happens when the local adapter scans the filesystem
        const files = [
          { id: 'file1.md', name: 'file1.md', path: 'file1.md', type: FileType.File as const, workspaceType: WorkspaceType.Local, workspaceId: wsId, content: 'hello', dirty: false, isSynced: true, syncStatus: 'idle', version: 1 },
          { id: 'file2.md', name: 'file2.md', path: 'file2.md', type: FileType.File as const, workspaceType: WorkspaceType.Local, workspaceId: wsId, content: 'world', dirty: false, isSynced: true, syncStatus: 'idle', version: 1 },
          { id: 'dir1', name: 'dir1', path: 'dir1', type: FileType.Directory as const, workspaceType: WorkspaceType.Local, workspaceId: wsId, children: ['file3.md'], dirty: false, isSynced: true, syncStatus: 'idle', version: 1 },
          { id: 'file3.md', name: 'file3.md', path: 'dir1/file3.md', type: FileType.File as const, workspaceType: WorkspaceType.Local, workspaceId: wsId, content: 'nested', dirty: false, isSynced: true, syncStatus: 'idle', version: 1 },
        ];

        for (const file of files) {
          await upsertCachedFile(file as any);
        }
      },
      isReady: () => true,
    } as any;

    mgr.registerAdapter(mockAdapter as any);

    // Open the local directory
    await mgr.requestOpenLocalDirectory(workspaceId);

    // Get all files from cache
    const allFiles = await getAllFiles(workspaceId);
    console.log('All files:', allFiles.map(f => ({ id: f.id, path: f.path, dirty: f.dirty })));

    // Verify that all files have dirty: false (not dirty)
    allFiles.forEach(file => {
      console.log(`Checking file ${file.id}: dirty=${file.dirty}`);
      expect(file.dirty).toBe(false);
    });

    // Get dirty files from cache - should be empty
    const dirtyFiles = await getDirtyFiles(workspaceId);
    console.log('Dirty files:', dirtyFiles.map(f => ({ id: f.id, path: f.path, dirty: f.dirty })));
    expect(dirtyFiles.length).toBe(0);
  });

  it('should not mark files as dirty when upserting with all required fields', async () => {
    const workspaceId = 'test-local-ws-2';

    // Test upserting a file with all required fields (this is the correct way)
    const file = {
      id: 'test-file.md',
      name: 'test-file.md',
      path: 'test-file.md',
      type: FileType.File,
      workspaceType: WorkspaceType.Local,
      workspaceId: workspaceId,
      content: 'test content',
      dirty: false,
      isSynced: true,
      syncStatus: 'idle',
      version: 1,
    } as any;

    await upsertCachedFile(file);

    // Get dirty files from cache - should be empty
    const dirtyFiles = await getDirtyFiles(workspaceId);
    console.log('Dirty files after upsert with required fields:', dirtyFiles);
    expect(dirtyFiles.length).toBe(0);

    // Get the file from cache and check its dirty status
    const allFiles = await getAllFiles(workspaceId);
    const uploaded = allFiles.find(f => f.id === 'test-file.md');
    console.log('File from cache:', uploaded);
    expect(uploaded).toBeDefined();
    if (uploaded) {
      // After fix, dirty should be false
      expect(uploaded.dirty).toBe(false);
    }
  });
});

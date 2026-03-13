import 'fake-indexeddb/auto';
import { vi } from 'vitest';

import { initializeRxDB, closeCacheDB, getDirtyFiles, getAllFiles } from '@/core/cache';
import { upsertCachedFile } from '@/core/cache/file-manager';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';
import { WorkspaceType } from '@/core/cache/types';
import { FileType } from '@/shared/types';

// ---------------------------------------------------------------------------
// Helpers — mock FileSystemDirectoryHandle
// ---------------------------------------------------------------------------

function makeFileEntry(name: string, content: string): any {
  return {
    kind: 'file',
    name,
    getFile: vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue(content),
      size: content.length,
      lastModified: Date.now(),
    }),
  };
}

function makeDirHandle(entries: Record<string, any>): any {
  const handle: any = {
    kind: 'directory',
    name: 'root',
    queryPermission: vi.fn().mockResolvedValue('granted'),
  };
  handle[Symbol.asyncIterator] = function* () {
    for (const [name, entry] of Object.entries(entries)) {
      yield [name, entry];
    }
  };
  return handle;
}

function makeDirEntry(name: string, children: Record<string, any>): any {
  const h = makeDirHandle(children);
  h.kind = 'directory';
  h.name = name;
  return h;
}

describe('Integration: load local directory shows files as dirty', () => {
  beforeEach(async () => {
    vi.resetModules();
    await initializeRxDB();
  });

  afterEach(async () => {
    try { await closeCacheDB(); } catch (_) { }
  });

  it('should not mark files as dirty when LocalAdapter.pull() loads a directory', async () => {
    const workspaceId = 'test-local-ws';

    const dirHandle = makeDirHandle({
      'file1.md': makeFileEntry('file1.md', 'hello'),
      'file2.md': makeFileEntry('file2.md', 'world'),
      sub: makeDirEntry('sub', {
        'file3.md': makeFileEntry('file3.md', 'nested'),
      }),
    });

    const adapter = new LocalAdapter(workspaceId);
    (adapter as any)._dirHandle = dirHandle;

    await adapter.pull();

    const allFiles = await getAllFiles(workspaceId);
    expect(allFiles.length).toBeGreaterThanOrEqual(3);

    for (const file of allFiles.filter(f => f.type === FileType.File)) {
      expect(file.dirty).toBe(false);
    }

    const dirtyFiles = await getDirtyFiles(workspaceId);
    expect(dirtyFiles.length).toBe(0);
  });

  it('should not mark files as dirty when upserting with isSynced:true', async () => {
    const workspaceId = 'test-local-ws-2';

    await upsertCachedFile({
      id: `${workspaceId}:test-file.md`,
      name: 'test-file.md',
      path: 'test-file.md',
      type: FileType.File,
      workspaceType: WorkspaceType.Local,
      workspaceId,
      content: 'test content',
      dirty: false,
      isSynced: true,
    } as any);

    const dirtyFiles = await getDirtyFiles(workspaceId);
    expect(dirtyFiles.length).toBe(0);

    const allFiles = await getAllFiles(workspaceId);
    const f = allFiles.find(f => f.path === 'test-file.md');
    expect(f).toBeDefined();
    expect(f!.dirty).toBe(false);
  });

  it('LocalAdapter.pull() skips node_modules and .DS_Store', async () => {
    const workspaceId = 'test-local-ws-3';

    const dirHandle = makeDirHandle({
      '.DS_Store': makeFileEntry('.DS_Store', ''),
      'node_modules': makeDirEntry('node_modules', {
        'package.js': makeFileEntry('package.js', 'code'),
      }),
      'notes.md': makeFileEntry('notes.md', '# notes'),
    });

    const adapter = new LocalAdapter(workspaceId);
    (adapter as any)._dirHandle = dirHandle;

    await adapter.pull();

    const allFiles = await getAllFiles(workspaceId);
    const paths = allFiles.map(f => f.path);
    expect(paths).toContain('notes.md');
    expect(paths).not.toContain('.DS_Store');
    expect(paths.some(p => p.includes('node_modules'))).toBe(false);
  });
});

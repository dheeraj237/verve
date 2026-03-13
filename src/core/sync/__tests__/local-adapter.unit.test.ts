import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (set up before importing LocalAdapter) ---

vi.mock('@/core/cache/file-manager', () => ({
  upsertCachedFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../handle-store', () => ({
  getHandle: vi.fn().mockResolvedValue(null),
  setHandle: vi.fn().mockResolvedValue(undefined),
  removeHandle: vi.fn().mockResolvedValue(undefined),
}));

// Provide workspace-ignore.json values directly so the module import works
vi.mock('../workspace-ignore.json', () => ({
  default: {
    ignoreNames: ['.DS_Store', 'Thumbs.db'],
    ignoreExtensions: ['.exe', '.dll'],
    ignoreFolders: ['node_modules', '.git'],
    maxFileSizeMB: 5,
  },
}));

import { upsertCachedFile } from '@/core/cache/file-manager';
import { getHandle } from '../handle-store';
import { LocalAdapter, PermissionError } from '../adapters/local-adapter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal mock FileSystemFileHandle */
function makeFileEntry(name: string, content: string, sizeBytes?: number): any {
  const size = sizeBytes ?? content.length;
  return {
    kind: 'file',
    name,
    getFile: vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue(content),
      size,
      lastModified: Date.now(),
    }),
  };
}

/** Builds a mock FileSystemDirectoryHandle with an async iterable child map. */
function makeDirHandle(entries: Record<string, any>): any {
  const handle: any = {
    kind: 'directory',
    name: 'root',
    queryPermission: vi.fn().mockResolvedValue('granted'),
  };
  // async iterable: [name, entry]
  handle[Symbol.asyncIterator] = function* () {
    for (const [name, entry] of Object.entries(entries)) {
      yield [name, entry];
    }
  };
  return handle;
}

function makeDirEntry(name: string, children: Record<string, any>): any {
  const dirHandle = makeDirHandle(children);
  dirHandle.kind = 'directory';
  dirHandle.name = name;
  return dirHandle;
}

/** Returns a LocalAdapter with a pre-seeded in-memory handle (bypasses IndexedDB). */
function adapterWithHandle(handle: any, wsId = 'ws1'): LocalAdapter {
  const a = new LocalAdapter(wsId);
  (a as any)._dirHandle = handle;
  return a;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocalAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldIncludeFolder', () => {
    const a = new LocalAdapter('ws');

    it('excludes node_modules', () => {
      expect(a.shouldIncludeFolder('node_modules')).toBe(false);
    });

    it('excludes .git', () => {
      expect(a.shouldIncludeFolder('.git')).toBe(false);
    });

    it('includes regular folders', () => {
      expect(a.shouldIncludeFolder('src')).toBe(true);
    });
  });

  describe('shouldIncludeFile', () => {
    const a = new LocalAdapter('ws');

    it('excludes .DS_Store', () => {
      expect(a.shouldIncludeFile('.DS_Store', '.DS_Store', 10)).toBe(false);
    });

    it('excludes .exe files', () => {
      expect(a.shouldIncludeFile('bin/app.exe', 'app.exe', 100)).toBe(false);
    });

    it('excludes files larger than maxFileSizeMB (5 MB)', () => {
      const sixMB = 6 * 1024 * 1024;
      expect(a.shouldIncludeFile('big.md', 'big.md', sixMB)).toBe(false);
    });

    it('includes normal markdown files', () => {
      expect(a.shouldIncludeFile('notes.md', 'notes.md', 1000)).toBe(true);
    });
  });

  describe('pull()', () => {
    it('upserts included files with dirty:false, isSynced:true', async () => {
      const dir = makeDirHandle({
        'readme.md': makeFileEntry('readme.md', '# hello'),
      });
      const adapter = adapterWithHandle(dir);
      await adapter.pull();

      expect(upsertCachedFile).toHaveBeenCalledOnce();
      const arg = (upsertCachedFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.dirty).toBe(false);
      expect(arg.isSynced).toBe(true);
      expect(arg.name).toBe('readme.md');
    });

    it('skips .DS_Store', async () => {
      const dir = makeDirHandle({
        '.DS_Store': makeFileEntry('.DS_Store', ''),
      });
      const adapter = adapterWithHandle(dir);
      await adapter.pull();
      expect(upsertCachedFile).not.toHaveBeenCalled();
    });

    it('skips .exe files', async () => {
      const dir = makeDirHandle({
        'app.exe': makeFileEntry('app.exe', 'binary', 1000),
      });
      const adapter = adapterWithHandle(dir);
      await adapter.pull();
      expect(upsertCachedFile).not.toHaveBeenCalled();
    });

    it('skips files larger than 5 MB', async () => {
      const sixMB = 6 * 1024 * 1024;
      const dir = makeDirHandle({
        'huge.md': makeFileEntry('huge.md', 'x'.repeat(sixMB), sixMB),
      });
      const adapter = adapterWithHandle(dir);
      await adapter.pull();
      expect(upsertCachedFile).not.toHaveBeenCalled();
    });

    it('does not recurse into node_modules', async () => {
      const nodeModulesDir = makeDirEntry('node_modules', {
        'lodash.js': makeFileEntry('lodash.js', 'code'),
      });
      const dir = makeDirHandle({ node_modules: nodeModulesDir });
      const adapter = adapterWithHandle(dir);
      await adapter.pull();
      expect(upsertCachedFile).not.toHaveBeenCalled();
    });

    it('walks nested directories', async () => {
      const inner = makeDirEntry('sub', {
        'inner.md': makeFileEntry('inner.md', 'nested content'),
      });
      const dir = makeDirHandle({ sub: inner });
      const adapter = adapterWithHandle(dir);
      await adapter.pull();

      expect(upsertCachedFile).toHaveBeenCalledOnce();
      const arg = (upsertCachedFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.path).toBe('sub/inner.md');
    });

    it('short-circuits when destroy() is called during pull', async () => {
      const adapter = new LocalAdapter('ws1');
      let callCount = 0;

      const dir: any = {
        kind: 'directory',
        name: 'root',
        queryPermission: vi.fn().mockResolvedValue('granted'),
      };
      dir[Symbol.asyncIterator] = async function* () {
        for (let i = 0; i < 5; i++) {
          // destroy on second file
          if (callCount === 1) adapter.destroy();
          callCount++;
          yield [`file${i}.md`, makeFileEntry(`file${i}.md`, 'content')];
        }
      };
      (adapter as any)._dirHandle = dir;

      await adapter.pull();
      // At most 1 upsert before destroy short-circuits
      expect((upsertCachedFile as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('short-circuits immediately when AbortSignal is already aborted', async () => {
      const dir = makeDirHandle({
        'a.md': makeFileEntry('a.md', 'content'),
      });
      const adapter = adapterWithHandle(dir);
      const controller = new AbortController();
      controller.abort();

      await adapter.pull(controller.signal);
      expect(upsertCachedFile).not.toHaveBeenCalled();
    });

    it('throws PermissionError when no handle is available', async () => {
      (getHandle as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const adapter = new LocalAdapter('ws-no-handle');
      await expect(adapter.pull()).rejects.toThrow(PermissionError);
    });
  });

  describe('push()', () => {
    it('writes content to the correct nested path', async () => {
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockFileHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };
      const mockSubDir: any = {
        kind: 'directory',
        name: 'docs',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        getDirectoryHandle: vi.fn().mockResolvedValue(undefined),
        getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
      };
      mockSubDir[Symbol.asyncIterator] = function* () {};

      const mockRoot: any = {
        kind: 'directory',
        name: 'root',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        getDirectoryHandle: vi.fn().mockResolvedValue(mockSubDir),
        getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
      };
      mockRoot[Symbol.asyncIterator] = function* () {};

      const adapter = adapterWithHandle(mockRoot);
      await adapter.push('docs/notes.md', '# content');

      expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('docs', { create: true });
      expect(mockSubDir.getFileHandle).toHaveBeenCalledWith('notes.md', { create: true });
      expect(mockWritable.write).toHaveBeenCalledWith('# content');
      expect(mockWritable.close).toHaveBeenCalled();
    });
  });

  describe('destroy()', () => {
    it('sets _destroyed and clears _dirHandle', () => {
      const adapter = adapterWithHandle(makeDirHandle({}));
      adapter.destroy();
      expect((adapter as any)._destroyed).toBe(true);
      expect((adapter as any)._dirHandle).toBeNull();
    });
  });
});

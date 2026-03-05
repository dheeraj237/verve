import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';
import * as workspaceManager from '@/core/cache/workspace-manager';
import * as fileManager from '@/core/cache/file-manager';

// Mock workspace-manager functions used by adapter (replaces previous idb helper)
vi.mock('@/core/cache/workspace-manager', () => ({
  storeDirectoryHandle: vi.fn().mockResolvedValue(undefined),
  requestPermissionForWorkspace: vi.fn().mockResolvedValue(undefined),
  removeDirectoryHandle: vi.fn().mockResolvedValue(undefined),
}));

// Mock cache upsert/save to avoid RxDB dependency in unit test
vi.mock('@/core/cache/file-manager', () => ({
  upsertCachedFile: vi.fn().mockResolvedValue(undefined),
  saveFile: vi.fn().mockResolvedValue(undefined),
  getAllFiles: vi.fn().mockResolvedValue([]),
}));

class MockFileHandle {
  constructor(private content: string) { }
  async getFile() {
    return { text: async () => this.content };
  }
}

class MockDirHandle {
  name: string;
  private entries: Record<string, any>;
  constructor(name: string, entries: Record<string, any> = {}) {
    this.name = name;
    this.entries = entries;
  }
  // emulate async iterator values()
  async *values() {
    for (const [n, v] of Object.entries(this.entries)) {
      yield v;
    }
  }
  async getFileHandle(name: string, _opts?: any) {
    const e = this.entries[name];
    if (e && e.kind === 'file') return new MockFileHandle(e.content || '');
    // create dummy
    return new MockFileHandle('');
  }
  async getDirectoryHandle(name: string, _opts?: any) {
    const e = this.entries[name];
    if (e && e.kind === 'directory') return e.handle;
    const h = new MockDirHandle(name, {});
    this.entries[name] = { kind: 'directory', name, handle: h };
    return h;
  }
}

describe('LocalAdapter unit', () => {
  const wm = workspaceManager;
  const { upsertCachedFile } = fileManager;
  const { saveFile } = fileManager;

  afterEach(() => {
    vi.clearAllMocks();
    // cleanup global picker
    // @ts-ignore
    delete (global as any).showDirectoryPicker;
    // @ts-ignore
    delete (global as any).window;
  });

  test('openDirectoryPicker initializes adapter and upserts files', async () => {
    const adapter = new LocalAdapter();

    // Create mock directory with one file
    const root = new MockDirHandle('root', {
      'foo.md': { kind: 'file', name: 'foo.md', getFile: async () => ({ text: async () => 'hello' }) },
    });

    // Mock window.showDirectoryPicker
    // @ts-ignore
    (global as any).window = global;
    // @ts-ignore
    (global as any).window.showDirectoryPicker = vi.fn().mockResolvedValue(root);

    await adapter.openDirectoryPicker('ws-test');

    expect(adapter.isReady()).toBe(true);
    expect(wm.storeDirectoryHandle).toHaveBeenCalledWith('ws-test', root);
    expect(upsertCachedFile).toHaveBeenCalled();
    expect(saveFile).toHaveBeenCalledWith('foo.md', 'hello', expect.anything(), undefined, 'ws-test');
  });

  test('promptPermissionAndRestore initializes adapter when handle granted', async () => {
    const adapter = new LocalAdapter();

    const root = new MockDirHandle('restored', {
      'bar.md': { kind: 'file', name: 'bar.md', content: 'world' },
    });

    // Mock requestPermissionForWorkspace to return handle
    wm.requestPermissionForWorkspace.mockResolvedValue(root);

    const ok = await adapter.promptPermissionAndRestore('ws-2');
    expect(ok).toBe(true);
    expect(adapter.isReady()).toBe(true);
    // should have loaded file handles (no direct upsert here because promptPermissionAndRestore does not scan)
  });
});
import 'fake-indexeddb/auto';

// Reuse the above workspace-manager and file-manager mocks.
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';
import { requestPermissionForWorkspace } from '@/core/cache/workspace-manager';
import { upsertCachedFile, saveFile } from '@/core/cache/file-manager';

describe('LocalAdapter FS interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // provide a fake window and showDirectoryPicker implementation
    (global as any).window = { showDirectoryPicker: vi.fn() } as any;
  });

  afterEach(() => {
    delete (global as any).showDirectoryPicker;
  });

  test('openDirectoryPicker scans and upserts files', async () => {
    // Create a fake directory handle with values() iterator and getFileHandle
    const fakeFileHandle = {
      getFile: async () => ({ text: async () => 'hello world' }),
    } as any;

    const fakeDirHandle = {
      name: 'fake-dir',
      async *values() {
        yield { kind: 'file', name: 'test.md' };
      },
      getFileHandle: async (name: string, opts?: any) => {
        return fakeFileHandle;
      },
      getDirectoryHandle: async (name: string, opts?: any) => {
        return fakeDirHandle;
      },
    } as any;

    (global as any).window.showDirectoryPicker.mockResolvedValue(fakeDirHandle);

    const adapter = new LocalAdapter();
    await adapter.openDirectoryPicker('ws-local');

    expect((global as any).window.showDirectoryPicker).toHaveBeenCalled();
    expect(adapter.isReady()).toBe(true);
  });

  test('promptPermissionAndRestore initializes with stored handle', async () => {
    const fakeFileHandle = {
      getFile: async () => ({ text: async () => 'content' }),
    } as any;

    const storedHandle = {
      name: 'stored-dir',
      async *values() {
        yield { kind: 'file', name: 'stored.md' };
      },
      getFileHandle: async () => fakeFileHandle,
      getDirectoryHandle: async () => storedHandle,
    } as any;

    (requestPermissionForWorkspace as Mock).mockResolvedValue(storedHandle);

    const adapter = new LocalAdapter();
    const ok = await adapter.promptPermissionAndRestore('ws-restore');
    expect(ok).toBe(true);
    expect(adapter.isReady()).toBe(true);
  });
});

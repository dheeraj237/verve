import 'fake-indexeddb/auto';

// Mock workspace-manager to avoid structured-clone issues in tests
jest.mock('@/core/cache/workspace-manager', () => ({
  storeDirectoryHandle: jest.fn().mockResolvedValue(undefined),
  requestPermissionForWorkspace: jest.fn().mockResolvedValue(undefined),
  removeDirectoryHandle: jest.fn().mockResolvedValue(undefined),
}));

import { initializeFileOperations } from '@/core/cache/file-manager';
import { getSyncManager } from '@/core/sync/sync-manager';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';
import { getAllFiles } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';

class MockFileHandle {
  constructor(private content: string) {}
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
  async *values() {
    for (const [n, v] of Object.entries(this.entries)) {
      // Yield objects with kind and name to mimic FileSystemDirectoryHandle
      if (v.kind === 'file') {
        yield { kind: 'file', name: v.name };
      } else if (v.kind === 'directory') {
        yield { kind: 'directory', name: v.name };
      }
    }
  }
  async getFileHandle(name: string, _opts?: any) {
    const e = this.entries[name];
    if (e && e.kind === 'file') return new MockFileHandle(e.content || '');
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

describe('SyncManager + LocalAdapter E2E', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initializeFileOperations();
  });

  afterEach(() => {
    try { getSyncManager().stop(); } catch (_) {}
  });

  test('requestOpenLocalDirectory scans and upserts files into RxDB', async () => {
    const mgr = getSyncManager();
    const adapter = new LocalAdapter();
    mgr.registerAdapter(adapter);

    // Create a mock directory containing a single markdown file
    const root = new MockDirHandle('root', {
      'note.md': { kind: 'file', name: 'note.md', content: 'e2e content' },
    });

    // Provide global window.showDirectoryPicker
    // @ts-ignore
    (global as any).window = global;
    // @ts-ignore
    (global as any).window.showDirectoryPicker = jest.fn().mockResolvedValue(root);

    await mgr.requestOpenLocalDirectory('ws-e2e');

    // Verify RxDB has the saved file entry for the workspace
    const files = await getAllFiles('ws-e2e');
    expect(files.some(f => f.path === 'note.md' || f.name === 'note.md')).toBeTruthy();

    // cleanup
    // @ts-ignore
    delete (global as any).window;
  });
});

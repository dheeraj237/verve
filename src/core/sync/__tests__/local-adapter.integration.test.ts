import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';

// Minimal Node-backed fake for the File System Access API used by the adapter.
class FakeFileHandle implements FileSystemFileHandle {
  constructor(private filePath: string) {}
  async getFile(): Promise<File> {
    const buf = await fs.readFile(this.filePath);
    const blob = new Blob([buf]);
    // @ts-ignore - create minimal File-like object
    return Object.assign(blob, { name: path.basename(this.filePath), lastModified: Date.now() });
  }
  async createWritable(): Promise<any> {
    const filePath = this.filePath;
    return {
      async write(data: string) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, data, 'utf8');
      },
      async close() {
        return;
      }
    };
  }
}

class FakeDirHandle implements FileSystemDirectoryHandle {
  constructor(private dirPath: string) {}
  async getDirectoryHandle(name: string, opts?: any): Promise<FakeDirHandle> {
    const p = path.join(this.dirPath, name);
    if (opts?.create) await fs.mkdir(p, { recursive: true });
    return new FakeDirHandle(p);
  }
  async getFileHandle(name: string, opts?: any): Promise<FakeFileHandle> {
    const p = path.join(this.dirPath, name);
    if (opts?.create) await fs.mkdir(path.dirname(p), { recursive: true });
    return new FakeFileHandle(p);
  }
  async removeEntry(name: string): Promise<void> {
    const p = path.join(this.dirPath, name);
    await fs.rm(p, { force: true, recursive: false });
  }
  // async iterator returning entries
  async *values() {
    const entries = await fs.readdir(this.dirPath, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      yield { kind: e.isDirectory() ? 'directory' : 'file', name: e.name } as any;
    }
  }
}

describe('LocalAdapter (integration)', () => {
  it('writes file to disk via push and returns true', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verve-local-adapter-'));
    const fakeRoot = new FakeDirHandle(tmpDir);

    const adapter = new LocalAdapter();
    await adapter.initialize(fakeRoot as any);

    const file = { id: 'test-file-1', path: 'subdir/test-file.md' } as any;
    const content = 'integration test content';

    const result = await adapter.push(file, content);
    expect(result).toBe(true);

    const fullPath = path.join(tmpDir, file.path);
    const written = await fs.readFile(fullPath, 'utf8');
    expect(written).toBe(content);

    // cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

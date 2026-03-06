import type { AdapterFileDescriptor, IPushAdapter, IPullAdapter, IWorkspaceAdapter } from '@/core/sync/adapter-types';

export class GDriveMock implements IPushAdapter, IPullAdapter, IWorkspaceAdapter {
  name = 'gdrive';
  private store: Map<string, string> = new Map();

  async push(file: AdapterFileDescriptor, content: string): Promise<boolean> {
    this.store.set(file.id, content);
    return true;
  }

  async pull(fileId: string): Promise<string | null> {
    return this.store.has(fileId) ? this.store.get(fileId) || '' : null;
  }

  async delete(fileId: string): Promise<boolean> {
    return this.store.delete(fileId);
  }

  async listWorkspaceFiles(workspaceId?: string): Promise<{ id: string; path: string; metadata?: any }[]> {
    const items: { id: string; path: string; metadata?: any }[] = [];
    for (const key of this.store.keys()) {
      items.push({ id: key, path: key, metadata: { workspaceId } });
    }
    return items;
  }

  async pullWorkspace(workspaceId?: string): Promise<Array<{ id: string; path: string; metadata?: Record<string, any> }>> {
    const out: Array<{ id: string; path: string; metadata?: Record<string, any> }> = [];
    for (const [k, v] of this.store.entries()) {
      out.push({ id: k, path: k, metadata: { content: v } });
    }
    return out;
  }
}

export default GDriveMock;

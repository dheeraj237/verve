import { initializeFileOperations } from '@/core/cache/file-manager';
import { initializeSyncManager } from '@/core/sync/sync-manager';
import type { ISyncAdapter } from '@/core/sync/sync-manager';

class MockAdapter implements ISyncAdapter {
  name = 'mock';
  async push(): Promise<boolean> { return true; }
  async pull(): Promise<string | null> { return null; }
  async exists(): Promise<boolean> { return false; }
  async delete(): Promise<boolean> { return true; }

  async pullWorkspace(workspaceId?: string) {
    console.log('MockAdapter.pullWorkspace called for', workspaceId);
    const items = [
      { fileId: `/mock/${workspaceId}/file1.md`, content: 'Hello from remote file1' },
      { fileId: `/mock/${workspaceId}/file2.md`, content: 'Hello from remote file2' },
    ];
    return items;
  }
}

async function main() {
  try {
    console.log('Initializing RxDB...');
    await initializeFileOperations();

    console.log('Initializing SyncManager with MockAdapter...');
    const manager = await initializeSyncManager([new MockAdapter() as any]);

    console.log('Calling pullWorkspace...');
    await manager.pullWorkspace({ id: 'mock-ws', type: 'local', path: '/' });

    console.log('pullWorkspace complete. Check RxDB for upserted entries.');
  } catch (err) {
    console.error('Test harness error:', err);
  }
}

main();

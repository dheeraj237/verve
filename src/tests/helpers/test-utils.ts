import 'fake-indexeddb/auto';

export async function initFileOps() {
  const fileOps = await import('@/core/cache/file-operations');
  await fileOps.initializeFileOperations();
  return fileOps;
}

export function resetModules() {
  jest.resetModules();
}

// Export the WorkspaceType enum for convenience in tests
export { WorkspaceType } from '@/core/cache/types';

export async function destroyCacheDB() {
  try {
    const { getCacheDB } = await import('@/core/cache/rxdb');
    const db = getCacheDB();
    if (db) await db.destroy();
  } catch (e) {
    // ignore
  }
}

export async function createWorkspace(name: string, type: any, id: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useWorkspaceStore } = require('@/core/store/workspace-store');
  useWorkspaceStore.getState().createWorkspace(name, type, { id });
}

export async function startSyncManagerWithAdapter(adapter: any) {
  const { getSyncManager } = await import('@/core/sync/sync-manager');
  const mgr = getSyncManager();
  mgr.registerAdapter(adapter);
  mgr.start();
  return mgr;
}

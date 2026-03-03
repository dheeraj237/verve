import 'fake-indexeddb/auto';

export async function initFileOps() {
  const fileOps = await import('@/core/cache/file-manager');
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

/**
 * Test helper: mock global.fetch to serve sample files from `public/content` on disk.
 * Use in Node/Jest tests so browser-only `loadSampleFilesFromFolder` can fetch sample files.
 */
export function mockFetchForSamples() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = jest.fn(async (url: string) => {
    try {
      const prefix = '/content';
      if (typeof url === 'string' && url.startsWith(prefix)) {
        const rel = url.slice(prefix.length);
        const diskPath = path.join(process.cwd(), 'public', 'content', rel.startsWith('/') ? rel.slice(1) : rel);
        const text = fs.readFileSync(diskPath, 'utf8');
        return {
          ok: true,
          status: 200,
          headers: { get: (k: string) => 'text/markdown' },
          text: async () => text,
        };
      }
    } catch (e) {
      // fall through to not found
    }

    return {
      ok: false,
      status: 404,
      headers: { get: () => '' },
      text: async () => '',
    };
  });
}

export function restoreFetchMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((global as any).fetch && (global as any).fetch.mockReset) (global as any).fetch.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try { delete (global as any).fetch; } catch (_) { (global as any).fetch = undefined; }
}

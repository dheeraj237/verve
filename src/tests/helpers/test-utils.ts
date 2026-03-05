import 'fake-indexeddb/auto';
import { vi } from 'vitest';

export async function initFileOps() {
  const fileOps = await import('@/core/cache/file-manager');
  await fileOps.initializeFileOperations();
  return fileOps;
}

export function resetModules() {
  vi.resetModules();
}

// Export the WorkspaceType enum for convenience in tests
export { WorkspaceType } from '@/core/cache/types';

export async function destroyCacheDB() {
  try {
    const { getCacheDB } = await import('@/core/cache/file-manager');
    const db = getCacheDB();
    if (db) await db.destroy();
  } catch (e) {
    // ignore
  }
}

export async function createWorkspace(name: string, type: any, id: string) {
  const { useWorkspaceStore } = await import('@/core/store/workspace-store');
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
 * Use in Node/Vitest tests so browser-only `loadSampleFilesFromFolder` can fetch sample files.
 */
export function mockFetchForSamples() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = vi.fn(async (url: string) => {
    try {
      // Handle both relative paths (/content/...) and full URLs (http://localhost:5173/content/...)
      if (typeof url === 'string' && url.includes('/content')) {
        // Extract the /content/... part from the URL
        const contentIndex = url.indexOf('/content');
        const contentPath = url.slice(contentIndex); // e.g., '/content/01-basic-formatting.md'
        const rel = contentPath.replace(/^\/content\/?/, ''); // e.g., '01-basic-formatting.md'
        const diskPath = path.join(process.cwd(), 'public', 'content', rel);
        const text = fs.readFileSync(diskPath, 'utf8');
        return {
          ok: true,
          status: 200,
          headers: { get: (k: string) => 'text/markdown' },
          text: async () => text,
        };
      }
    } catch (e) {
      console.error('[mockFetchForSamples] Error loading sample file:', e);
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
  if ((global as any).fetch && (global as any).fetch.mockClear) (global as any).fetch.mockClear();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try { delete (global as any).fetch; } catch (_) { (global as any).fetch = undefined; }
}

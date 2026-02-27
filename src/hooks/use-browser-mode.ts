/**
 * Browser Initialization Hook
 * Initializes RxDB cache and default workspace on app startup
 */

import { useEffect, useState } from 'react';
import { initializeFileOperations, loadSampleFilesFromFolder } from '@/core/cache/file-operations';
import { initializeSyncManager } from '@/core/sync/sync-manager';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';
import { GDriveAdapter } from '@/core/sync/adapters/gdrive-adapter';
import { S3Adapter } from '@/core/sync/adapters/s3-adapter';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType } from '@/core/cache/types';

// Exported for testing: performs app initialization and pulls active workspace
export async function initializeApp(adapters?: any[]) {
  // Initialize RxDB cache as single source of truth
  await initializeFileOperations();

  // Create default workspace only when there are no existing workspaces
  const verveStore = useWorkspaceStore.getState();
  if (!verveStore.workspaces || verveStore.workspaces.length === 0) {
    verveStore.createWorkspace('Verve Samples', WorkspaceType.Browser, { id: 'verve-samples' });
    await loadSampleFilesFromFolder();
  }

  // Initialize SyncManager with provided adapters or defaults
  if (adapters && Array.isArray(adapters)) {
    await initializeSyncManager(adapters);
  } else {
    const win: any = typeof window !== 'undefined' ? window : {};
    const baseDir = win.__VERVE_LOCAL_BASE_DIR || (process.env.VITE_LOCAL_BASE_DIR as string) || './';
    await initializeSyncManager([
      new LocalAdapter(baseDir),
      new GDriveAdapter(),
      new S3Adapter('', ''),
    ]);
  }

  // After sync manager initialized, pull the active workspace to populate cache
  try {
    const active = useWorkspaceStore.getState().activeWorkspace?.();
    if (active && active.type !== WorkspaceType.Browser) {
      await (await import('@/core/sync/sync-manager')).getSyncManager().pullWorkspace(active);
    }
  } catch (err) {
    console.warn('Failed to pull active workspace during initializeApp:', err);
  }
}

export function useBrowserMode() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createWorkspace, workspaces } = useWorkspaceStore();

  useEffect(() => {
    initializeApp().then(() => setIsInitialized(true)).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to initialize file cache');
      console.error('File cache initialization error:', err);
    });
  }, []);

  return {
    isInitialized,
    error,
  };
}

/**
 * Get the global file cache (deprecated - use file-operations directly)
 */
export function getBrowserAdapter(workspaceId: string = 'default') {
  console.warn('getBrowserAdapter is deprecated - use file-operations from @/core/cache instead');
  return null;
}

export function getBrowserFileManager() {
  console.warn('getBrowserFileManager is deprecated - use file-operations from @/core/cache instead');
  return null;
}

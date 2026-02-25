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

export function useBrowserMode() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createWorkspace, workspaces } = useWorkspaceStore();

  useEffect(() => {
    const initializeCache = async () => {
      try {
        // Initialize RxDB cache as single source of truth
        await initializeFileOperations();

        // Create default workspace if it doesn't exist
        const verveStore = useWorkspaceStore.getState();
        const hasVerveWorkspace = verveStore.workspaces.some(ws => ws.id === 'verve-samples');
        
        if (!hasVerveWorkspace) {
          console.log('[BrowserMode] Creating default "Verve Samples" workspace...');
          verveStore.createWorkspace('Verve Samples', 'browser', { id: 'verve-samples' });
          
          // Load sample files into the new workspace
          console.log('[BrowserMode] Loading sample files...');
          await loadSampleFilesFromFolder();
          console.log('[BrowserMode] Sample files loaded');
        }

        // Initialize SyncManager with available adapters. Adapters are
        // responsible for doing external I/O; they will be no-ops in
        // environments where their APIs are not available (e.g., browser).
        try {
          // Determine a sensible baseDir for LocalAdapter. When running in
          // Electron, the preload script or main process may expose a global
          // `__VERVE_LOCAL_BASE_DIR`. Also allow Vite env var `VITE_LOCAL_BASE_DIR`.
          const win: any = typeof window !== 'undefined' ? window : {};
          const baseDir = win.__VERVE_LOCAL_BASE_DIR || (import.meta.env.VITE_LOCAL_BASE_DIR as string) || './';

          await initializeSyncManager([
            new LocalAdapter(baseDir),
            new GDriveAdapter(),
            new S3Adapter('', ''),
          ]);
          console.log('[BrowserMode] SyncManager initialized');
        } catch (err) {
          console.warn('Failed to initialize SyncManager:', err);
        }

        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize file cache');
        console.error('File cache initialization error:', err);
      }
    };

    initializeCache();
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

/**
 * Browser Initialization Hook
 * Initializes RxDB cache and default workspace on app startup
 */

import { useEffect, useState } from 'react';
import { initializeFileOperations, loadSampleFilesFromFolder } from '@/core/cache/file-manager';
import { getSyncManager } from '@/core/sync/sync-manager';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType } from '@/core/cache/types';
import { checkAndHandleDeployment } from '@/core/init/deployment-version-manager';

// Exported for testing: performs app initialization and pulls active workspace
export async function initializeApp(adapters?: any[]) {
  // Check for new deployment and wipe IndexedDB if needed BEFORE initializing RxDB
  const deploymentOccurred = await checkAndHandleDeployment();

  if (deploymentOccurred) {
    console.log('[initializeApp] New deployment detected - IndexedDB was cleared');
  }

  // Initialize RxDB cache as single source of truth
  await initializeFileOperations();

  // Create default workspace only when there are no existing workspaces
  const verveStore = useWorkspaceStore.getState();
  // Ensure the `verve-samples` browser workspace exists and is populated.
  const hasSamples = verveStore.workspaces && verveStore.workspaces.find(w => w.id === 'verve-samples');
  if (!hasSamples) {
    verveStore.createWorkspace('Verve Samples', WorkspaceType.Browser, { id: 'verve-samples' });
    // Ensure store state contains the sample workspace immediately (defensive against rehydration timing)
    useWorkspaceStore.setState((s) => {
      const exists = s.workspaces && s.workspaces.find(w => w.id === 'verve-samples');
      if (exists) return s;
      const ws = {
        id: 'verve-samples',
        name: 'Verve Samples',
        type: WorkspaceType.Browser,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      } as any;
      return { workspaces: [...(s.workspaces || []), ws], activeWorkspaceId: 'verve-samples' } as any;
    });
    await loadSampleFilesFromFolder();
  }

  // Start SyncManager — subscribes to workspace store changes and mounts the active workspace.
  getSyncManager().start();

  // Explicitly mount any non-browser active workspace so the initial pull runs now
  // (start() subscribes for future changes; the current workspace needs a manual trigger).
  try {
    const active = useWorkspaceStore.getState().activeWorkspace?.();
    if (active && active.type !== WorkspaceType.Browser) {
      await getSyncManager().mountWorkspace(active.id, 'local');
    }
  } catch (err) {
    console.warn('[initializeApp] Failed to mount active workspace:', err);
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
 * Get the global file cache (deprecated - use file-manager directly)
 */
export function getBrowserAdapter(workspaceId: string = 'default') {
  console.warn('getBrowserAdapter is deprecated - use file-manager from @/core/cache instead');
  return null;
}

export function getBrowserFileManager() {
  console.warn('getBrowserFileManager is deprecated - use file-manager from @/core/cache instead');
  return null;
}

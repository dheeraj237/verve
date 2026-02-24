/**
 * Demo Initialization Hook
 * Initializes demo files on app startup with File Manager V2
 */

import { useEffect, useState } from 'react';
import { DemoAdapterV2 } from '@/core/file-manager-v2/adapters/demo-adapter';
import { FileManager } from '@/core/file-manager-v2/file-manager';

let demoAdapter: DemoAdapterV2 | null = null;
let fileManager: FileManager | null = null;

export function useDemoMode() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDemo = async () => {
      try {
        if (!demoAdapter) {
          demoAdapter = new DemoAdapterV2();
          await demoAdapter.initialize();
          fileManager = new FileManager(demoAdapter);
        }
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize demo');
        console.error('Demo initialization error:', err);
      }
    };

    initializeDemo();
  }, []);

  return {
    isInitialized,
    error,
    adapter: demoAdapter,
    fileManager,
  };
}

export function getDemoAdapter(workspaceId: string = 'default') {
  // Always create a new adapter with the specific workspace ID
  // This ensures each workspace has its own isolated adapter
  const adapter = new DemoAdapterV2(workspaceId);
  adapter.initialize().catch(err => {
    console.error(`Failed to initialize demo adapter for workspace ${workspaceId}:`, err);
  });
  return adapter;
}

export function getDemoFileManager() {
  if (!fileManager) {
    fileManager = new FileManager(getDemoAdapter());
  }
  return fileManager;
}

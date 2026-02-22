/**
 * Demo Initialization Hook
 * Initializes demo files on app startup
 */

import { useEffect, useState } from 'react';
import { DemoFileSystemAdapter } from '@/core/file-manager/adapters/demo-adapter';
import { FileManager } from '@/core/file-manager/file-manager';

let demoAdapter: DemoFileSystemAdapter | null = null;
let fileManager: FileManager | null = null;

export function useDemoMode() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDemo = async () => {
      try {
        if (!demoAdapter) {
          demoAdapter = new DemoFileSystemAdapter();
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

export function getDemoAdapter() {
  if (!demoAdapter) {
    demoAdapter = new DemoFileSystemAdapter();
  }
  return demoAdapter;
}

export function getDemoFileManager() {
  if (!fileManager) {
    fileManager = new FileManager(getDemoAdapter());
  }
  return fileManager;
}

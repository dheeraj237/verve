/**
 * File Manager V2 integration with Workspace Store
 */

import { FileManager, DemoAdapterV2, LocalAdapterV2, GoogleDriveAdapterV2, WorkspaceAdapter } from '@/core/file-manager-v2';
import { requestDriveAccessToken } from '@/core/auth/google';
import type { Workspace } from './workspace-store';

/**
 * Create appropriate adapter based on workspace type
 */
export function createAdapterForWorkspace(workspace: Workspace): WorkspaceAdapter {
  switch (workspace.type) {
    case 'browser': {
      const adapter = new DemoAdapterV2();
      // Initialize asynchronously
      adapter.initialize().catch(err => 
        console.error('Failed to initialize DemoAdapter:', err)
      );
      return adapter;
    }

    case 'local': {
      const adapter = new LocalAdapterV2();
      // Local adapter needs directory handle - will be initialized separately
      return adapter;
    }

    case 'drive': {
      const adapter = new GoogleDriveAdapterV2(
        () => requestDriveAccessToken(false),
        workspace.driveFolder
      );
      return adapter;
    }

    default:
      throw new Error(`Unsupported workspace type: ${(workspace as any).type}`);
  }
}

/**
 * Global file manager instance (singleton)
 */
let globalFileManager: FileManager | null = null;

/**
 * Get or create the global file manager instance
 */
export function getFileManager(workspace?: Workspace): FileManager {
  if (!globalFileManager && workspace) {
    const adapter = createAdapterForWorkspace(workspace);
    globalFileManager = new FileManager(adapter);
  }

  if (!globalFileManager) {
    throw new Error('FileManager not initialized. Please provide a workspace.');
  }

  return globalFileManager;
}

/**
 * Switch file manager to a different workspace
 */
export async function switchFileManager(workspace: Workspace): Promise<FileManager> {
  const adapter = createAdapterForWorkspace(workspace);
  
  if (globalFileManager) {
    await globalFileManager.switchAdapter(adapter, true);
  } else {
    globalFileManager = new FileManager(adapter);
  }

  return globalFileManager;
}

/**
 * Dispose the global file manager
 */
export function disposeFileManager(): void {
  if (globalFileManager) {
    globalFileManager.dispose();
    globalFileManager = null;
  }
}

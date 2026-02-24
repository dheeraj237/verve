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
      const adapter = new DemoAdapterV2(workspace.id);
      // Initialize asynchronously
      adapter.initialize().catch(err => 
        console.error('Failed to initialize DemoAdapter:', err)
      );
      return adapter;
    }

    case 'local': {
      const adapter = new LocalAdapterV2();
      // Initialize with directory handle if available
      const dirHandle = (window as any).__localDirHandle;
      if (dirHandle) {
        adapter.initialize(dirHandle).catch(err =>
          console.error('Failed to initialize LocalAdapter:', err)
        );
      } else {
        console.warn('Local adapter created but no directory handle available');
      }
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
let currentWorkspaceId: string | null = null;

/**
 * Get or create the global file manager instance
 * Automatically switches adapter if workspace changed
 */
export function getFileManager(workspace?: Workspace): FileManager {
  // If workspace provided and it's different from current, switch adapter
  if (workspace && workspace.id !== currentWorkspaceId) {
    console.log(`[FileManagerIntegration] Workspace changed: ${currentWorkspaceId} -> ${workspace.id}`);

    const adapter = createAdapterForWorkspace(workspace);

    if (globalFileManager) {
      // Switch adapter on existing manager
      globalFileManager.switchAdapter(adapter, false).catch(err =>
        console.error('Failed to switch adapter:', err)
      );
    } else {
      // Create new manager
      globalFileManager = new FileManager(adapter);
    }

    currentWorkspaceId = workspace.id;
  } else if (!globalFileManager && workspace) {
  // First time initialization
    const adapter = createAdapterForWorkspace(workspace);
    globalFileManager = new FileManager(adapter);
    currentWorkspaceId = workspace.id;
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
  console.log(`[FileManagerIntegration] Explicitly switching to workspace: ${workspace.id}`);

  const adapter = createAdapterForWorkspace(workspace);
  
  if (globalFileManager) {
    await globalFileManager.switchAdapter(adapter, true);
  } else {
    globalFileManager = new FileManager(adapter);
  }

  currentWorkspaceId = workspace.id;
  return globalFileManager;
}

/**
 * Dispose the global file manager
 */
export function disposeFileManager(): void {
  if (globalFileManager) {
    globalFileManager.dispose();
    globalFileManager = null;
    currentWorkspaceId = null;
  }
}

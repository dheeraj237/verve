import { FileNode } from "@/shared/types";
import { buildFileTreeFromDirectory, buildFileTreeFromAdapter } from "./file-tree-builder";
import { WorkspaceType } from '@/core/cache/types';
import { getSyncManager } from '@/core/sync/sync-manager';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';

/**
 * Opens a local directory using File System Access API
 * Shows directory picker and builds file tree from selected directory
 * Optionally stores the directory handle in IndexedDB for later restoration
 * 
 * @param workspaceId - Optional workspace ID for storing the directory handle
 * @returns Promise with the directory name, path, and file tree
 * @throws Error if user cancels or API not supported
 */
export async function openLocalDirectory(workspaceId?: string): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
}> {
  const wsId = workspaceId ?? 'local';
  await getSyncManager().requestPermission(wsId);

  const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, workspaceId);
  return { name: workspaceId ?? 'Local', path: workspaceId ?? '/', fileTree: tree };
}

/**
 * Restores a previously opened local directory from IndexedDB
 * Used to persist directory access across browser sessions
 * 
 * @param workspaceId - Workspace ID used when storing the directory
 * @returns Promise with the directory data or null if not found/failed
 */
export async function restoreLocalDirectory(workspaceId: string): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
} | null> {
  try {
    const ok = await getSyncManager().requestPermission(workspaceId);
    if (!ok) return null;
    const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, workspaceId);
    return { name: workspaceId, path: workspaceId, fileTree: tree };
  } catch (error) {
    console.error('Error restoring directory:', error);
    return null;
  }
}

/**
 * Prompt the user (via a click/gesture) to re-request permission for a stored workspace.
 * Returns the directory data if permission is granted and the tree can be built.
 */
export async function promptPermissionAndRestore(workspaceId: string): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
} | null> {
  try {
    const ok = await getSyncManager().requestPermission(workspaceId);
    if (!ok) return null;
    const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, workspaceId);
    return { name: workspaceId, path: workspaceId, fileTree: tree };
  } catch (error) {
    console.error('Error prompting permission and restoring directory:', error);
    return null;
  }
}

/**
 * Refreshes the file tree for the currently opened local directory
 * Re-scans the directory to pick up any external changes
 * 
 * @returns Promise with the updated file tree or null if no directory is open
 */
export async function refreshLocalDirectory(): Promise<FileNode[] | null> {
  // Rebuild tree from cache for the active local workspace
  try {
    // Attempt to discover active workspace id
    const activeWs = (await import('@/core/store/workspace-store')).useWorkspaceStore.getState().activeWorkspace?.();
    const wsId = activeWs?.id;
    const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, wsId);
    return tree;
  } catch (e) {
    console.warn('refreshLocalDirectory failed:', e);
    return null;
  }
}

/**
 * Checks if a local directory is currently open
 * 
 * @returns true if a directory handle exists
 */
export async function hasLocalDirectoryAsync(): Promise<boolean> {
  const { useWorkspaceStore } = await import('@/core/store/workspace-store');
  const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
  if (!activeWs || activeWs.type !== 'local') return false;
  return LocalAdapter.hasPersistedHandle(activeWs.id);
}

/**
 * Clears the currently open local directory
 * Removes the global directory handle reference
 */
export async function clearLocalDirectory(): Promise<void> {
  try {
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');
    const wsId = useWorkspaceStore.getState().activeWorkspace?.()?.id;
    if (wsId) {
      getSyncManager().unmountWorkspace(wsId);
      await LocalAdapter.clearPersistedHandle(wsId);
    }
  } catch (_) {
    // ignore
  }
}

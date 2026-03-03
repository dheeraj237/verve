import { FileNode } from "@/shared/types";
import { buildFileTreeFromDirectory, buildFileTreeFromAdapter } from "./file-tree-builder";
import { getSyncManager } from '@/core/sync/sync-manager';
import { WorkspaceType } from '@/core/cache/types';
import { removeDirectoryHandle } from '@/core/cache/workspace-manager';

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
  // Delegate to SyncManager facade which runs user-gesture directory picker and adapter scanning.
  const sm = getSyncManager();
  await sm.requestOpenLocalDirectory(workspaceId);

  // After adapter has scanned and upserted files into RxDB, build file tree from cache.
  const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, workspaceId);
  // Name/path are best-effort: use workspaceId as path when available
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
    const sm = getSyncManager();
    const ok = await sm.requestPermissionForLocalWorkspace(workspaceId);
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
    const sm = getSyncManager();
    const ok = await sm.requestPermissionForLocalWorkspace(workspaceId);
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
  // Rebuild tree from RxDB cache for the active local workspace
  try {
    const sm = getSyncManager();
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
export function hasLocalDirectory(): boolean {
  // Query local adapter readiness via SyncManager
  try {
    const adapter = getSyncManager().getAdapter('local');
    if (!adapter) return false;
    return typeof (adapter as any).isReady === 'function' ? (adapter as any).isReady() : false;
  } catch (e) {
    return false;
  }
}

/**
 * Clears the currently open local directory
 * Removes the global directory handle reference
 */
export function clearLocalDirectory(): void {
  // Dispose local adapter and remove stored directory handle from IndexedDB
  try {
    const adapter = getSyncManager().getAdapter('local');
    if (adapter && typeof (adapter as any).dispose === 'function') {
      (adapter as any).dispose().catch(() => { });
    }
  } catch (e) {
    // ignore
  }
  try {
    import('@/core/store/workspace-store').then((mod) => {
      try {
        const wsId = mod.useWorkspaceStore.getState().activeWorkspace?.()?.id;
        if (wsId) (async () => { try { await removeDirectoryHandle(wsId); } catch (_) { } })();
      } catch (_) { }
    }).catch(() => { });
  } catch (_) { }
}

import { useWorkspaceStore } from '@/core/store/workspace-store';
import {
  saveFile,
  createDirectory,
  deleteFile as deleteFileRxDB,
  renameFile as renameFileRxDB,
  initializeFileOperations,
} from '@/core/cache/file-manager';
import { getCachedFile } from '@/core/cache';
import { existsInWorkspace } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';
import { subscribeToWorkspaceFiles } from '@/core/cache/file-manager';

/**
 * Get the active workspace type
 */
function getActiveWorkspaceType() {
  const workspace = useWorkspaceStore.getState().activeWorkspace();
  return workspace?.type || WorkspaceType.Browser;
}

/**
 * Creates a new file in the specified location
 * Uses RxDB cache for all workspace types
 * 
 * @param parentPath - Path of the parent folder (with prefix: 'gdrive-', 'local-', or empty for browser/samples)
 * @param fileName - Name of the file to create
 * @throws Error if file creation fails
 */
export async function createFile(parentPath: string, fileName: string): Promise<void> {
  try {
    // Ensure RxDB and file-manager are initialized in browser
    try {
      await initializeFileOperations();
    } catch (initErr) {
      console.warn('Failed to initialize file operations before creating file:', initErr);
      // proceed — saveFile will throw if DB is unavailable
    }
    const workspaceType = getActiveWorkspaceType();
    const workspace = useWorkspaceStore.getState().activeWorkspace?.();
    const workspaceId = workspace?.id;

    // Normalize parentPath: treat '/' or empty as root (''), preserve leading slash if present
    const normalizedParent = (!parentPath || parentPath === '/') ? '' : parentPath.replace(/\/$/, '');
    const filePath = normalizedParent ? `${normalizedParent}/${fileName}` : fileName;

    // Prevent overwriting existing file or folder at the same path (workspace-scoped)
    const exists = await existsInWorkspace(filePath, workspaceId);
    if (exists) throw new Error(`A file or folder already exists at path: ${filePath}`);
    // Provide sensible default content for certain filenames
    let defaultContent = '';
    const lowerName = fileName.toLowerCase();

    // Keep default content empty for new files, even for sample names
    if (lowerName === 'verve.md') {
      defaultContent = '';
    }

    // Persist to RxDB cache first (single source of truth).
    // Actual target (local disk, gdrive, etc.) will be updated by SyncManager
    // which subscribes to RxDB changes and performs async pushes.
    await saveFile(filePath, defaultContent, workspaceType, undefined, workspaceId);
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
}

/**
 * Creates a new folder in the specified location
 * Uses RxDB cache for all workspace types
 * 
 * @param parentPath - Path of the parent folder (with prefix)
 * @param folderName - Name of the folder to create
 * @throws Error if folder creation fails
 */
export async function createFolder(parentPath: string, folderName: string): Promise<void> {
  try {
    // Ensure RxDB is initialized
    try {
      await initializeFileOperations();
    } catch (initErr) {
      console.warn('Failed to initialize file operations before creating folder:', initErr);
    }
    const workspaceType = getActiveWorkspaceType();
    const workspace = useWorkspaceStore.getState().activeWorkspace?.();
    const workspaceId = workspace?.id;

    const normalizedParent = (!parentPath || parentPath === '/') ? '' : parentPath.replace(/\/$/, '');
    const folderPath = normalizedParent ? `${normalizedParent}/${folderName}` : folderName;

    // Prevent creating a folder where a file or folder already exists (workspace-scoped)
    const existsFolder = await existsInWorkspace(folderPath, workspaceId);
    if (existsFolder) throw new Error(`A file or folder already exists at path: ${folderPath}`);
    // Persist directory to RxDB cache first. SyncManager will handle
    // creating the actual directory on the target storage later.
    await createDirectory(folderPath, workspaceType, workspaceId);
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
}

/**
 * Deletes a file or folder
 * Uses RxDB cache for all workspace types
 * 
 * @param nodePath - Path of the node to delete (with prefix)
 * @param isFolder - Whether the node is a folder
 * @throws Error if deletion fails
 */
export async function deleteNode(nodePath: string, isFolder: boolean): Promise<void> {
  try {
    const workspace = useWorkspaceStore.getState().activeWorkspace?.();
    const workspaceId = workspace?.id;
    // Delete from RxDB cache first; SyncManager will remove from actual
    // target storage asynchronously based on workspace type and workspaceId.
    await deleteFileRxDB(nodePath, workspaceId);

    // Note: Do not perform local filesystem side-effects here.
    // UI code should only update the RxDB cache (UI → RxDB).
    // The SyncManager and adapters will observe the change and perform
    // the actual deletion on the target storage asynchronously.
  } catch (error) {
    console.error('Error deleting:', error);
    throw error;
  }
}

/**
 * Renames a file or folder
 * Uses RxDB cache for all workspace types
 * 
 * @param nodePath - Current path of the node
 * @param newName - New name for the node
 * @throws Error if rename fails or not supported
 */
export async function renameNode(nodePath: string, newName: string): Promise<void> {
  try {
    const pathParts = nodePath.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');

    const workspace = useWorkspaceStore.getState().activeWorkspace?.();
    const workspaceId = workspace?.id;
    // Rename in RxDB first; SyncManager will handle renaming on the actual
    // target storage asynchronously.
    await renameFileRxDB(nodePath, newPath, workspaceId);
  } catch (error) {
    console.error('Error renaming:', error);
    throw error;
  }
}

/**
 * Subscribe to current active workspace file list and invoke callback on updates.
 * Returns an unsubscribe function.
 */
export function subscribeToActiveWorkspaceFiles(callback: (files: any[]) => void): () => void {
  let currentWorkspaceId = useWorkspaceStore.getState().activeWorkspace()?.id ?? null;

  // Create initial subscription
  let unsub = subscribeToWorkspaceFiles(currentWorkspaceId, callback);

  // Listen for workspace changes and re-subscribe when it changes
  const unsubscribeStore = (useWorkspaceStore.subscribe as any)(
    (s) => s.activeWorkspaceId,
    (newId) => {
      try { unsub(); } catch (_) { }
      currentWorkspaceId = newId ?? null;
      unsub = subscribeToWorkspaceFiles(currentWorkspaceId, callback);
    }
  );

  return () => {
    try { unsub(); } catch (_) { }
    try { unsubscribeStore(); } catch (_) { }
  };
}

// NOTE: Local filesystem operations were intentionally removed from this
// helper because `file-explorer` should only update the RxDB cache (UI → RxDB).
// Actual filesystem side-effects (local disk, gdrive, etc.) are performed by
// the central `SyncManager` and adapters which subscribe to RxDB changes.

// Local filesystem helpers removed. SyncManager/adapters perform actual I/O.

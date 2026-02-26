import { useWorkspaceStore } from '@/core/store/workspace-store';
import {
  saveFile,
  createDirectory,
  deleteFile as deleteFileRxDB,
  renameFile as renameFileRxDB,
  initializeFileOperations,
} from '@/core/cache/file-operations';
import { getDirectoryHandle } from '@/shared/utils/idb-storage';

/**
 * Get the active workspace type
 */
function getActiveWorkspaceType() {
  const workspace = useWorkspaceStore.getState().activeWorkspace();
  return workspace?.type || 'browser';
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
    // Ensure RxDB and file-operations are initialized in browser
    try {
      await initializeFileOperations();
    } catch (initErr) {
      console.warn('Failed to initialize file operations before creating file:', initErr);
      // proceed — saveFile will throw if DB is unavailable
    }
    const workspaceType = getActiveWorkspaceType();
    const workspace = useWorkspaceStore.getState().activeWorkspace?.();
    const workspaceId = workspace?.id;
    const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;
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
    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
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

/** Helpers for local filesystem operations */
async function getLocalRootHandle(workspaceId?: string): Promise<FileSystemDirectoryHandle | null> {
  // Prefer in-memory handle set by directory-handler
  const win = window as any;
  if (win && win.__localDirHandle) return win.__localDirHandle as FileSystemDirectoryHandle;

  // Fallback: try to retrieve stored handle from IndexedDB without prompting
  try {
    const handle = await getDirectoryHandle(workspaceId || '');
    return handle;
  } catch (e) {
    console.warn('No local dir handle available:', e);
    return null;
  }
}

async function traverseToParent(root: FileSystemDirectoryHandle, path: string, create = false): Promise<{ parent: FileSystemDirectoryHandle; name: string } | null> {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { parent: root, name: '' };

  const name = parts.pop() as string;
  let dir: FileSystemDirectoryHandle = root;
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part, { create });
    } catch (e) {
      return null;
    }
  }

  return { parent: dir, name };
}

async function writeFileToLocal(path: string, content: string, workspaceId?: string): Promise<void> {
  const root = await getLocalRootHandle(workspaceId);
  if (!root) throw new Error('No local directory handle available');

  const res = await traverseToParent(root, path, true);
  if (!res) throw new Error('Failed to traverse to parent directory');

  const { parent, name } = res;
  const fileHandle = await parent.getFileHandle(name, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();
}

async function createFolderLocal(path: string, workspaceId?: string): Promise<void> {
  const root = await getLocalRootHandle(workspaceId);
  if (!root) throw new Error('No local directory handle available');

  const res = await traverseToParent(root, path, true);
  if (!res) throw new Error('Failed to traverse to parent directory');

  // createDirectory handled by traverse (create=true), nothing else needed
}

async function deleteLocalEntry(path: string, isFolder: boolean, workspaceId?: string): Promise<void> {
  const root = await getLocalRootHandle(workspaceId);
  if (!root) throw new Error('No local directory handle available');

  const res = await traverseToParent(root, path, false);
  if (!res) throw new Error('Failed to traverse to parent directory');

  const { parent, name } = res;
  // Use removeEntry when available
  try {
    if (typeof (parent as any).removeEntry === 'function') {
      await (parent as any).removeEntry(name, { recursive: !!isFolder });
    } else {
      // Fallback: try to get handle and remove contents manually for folders
      if (isFolder) {
        // No reliable fallback implemented
        throw new Error('removeEntry not supported in this browser');
      } else {
        // Can't remove file without removeEntry
        throw new Error('removeEntry not supported in this browser');
      }
    }
  } catch (e) {
    throw e;
  }
}

async function renameLocalEntry(oldPath: string, newPath: string, workspaceId?: string): Promise<void> {
  const root = await getLocalRootHandle(workspaceId);
  if (!root) throw new Error('No local directory handle available');

  // Handle files only for now
  const oldRes = await traverseToParent(root, oldPath, false);
  const newRes = await traverseToParent(root, newPath, true);
  if (!oldRes || !newRes) throw new Error('Failed to traverse directories for rename');

  const { parent: oldParent, name: oldName } = oldRes;
  const { parent: newParent, name: newName } = newRes;

  try {
    const oldHandle = await oldParent.getFileHandle(oldName);
    const file = await oldHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();

    const newHandle = await newParent.getFileHandle(newName, { create: true });
    const writable = await (newHandle as any).createWritable();
    await writable.write(new Uint8Array(arrayBuffer));
    await writable.close();

    // Remove old entry
    if (typeof (oldParent as any).removeEntry === 'function') {
      await (oldParent as any).removeEntry(oldName);
    }
  } catch (e) {
    throw e;
  }
}

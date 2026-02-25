import { useWorkspaceStore } from '@/core/store/workspace-store';
import {
  saveFile,
  createDirectory,
  deleteFile as deleteFileRxDB,
  renameFile as renameFileRxDB,
  initializeFileOperations,
} from '@/core/cache/file-operations';

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

    if (lowerName === 'verve.md') {
      defaultContent = '# Verve 🚀';
    }

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
    await renameFileRxDB(nodePath, newPath, workspaceId);
  } catch (error) {
    console.error('Error renaming:', error);
    throw error;
  }
}

import { getFileManager } from '@/core/store/file-manager-integration';
import { useWorkspaceStore } from '@/core/store/workspace-store';

/**
 * Get the active file manager instance
 */
function getActiveManager() {
  const workspace = useWorkspaceStore.getState().activeWorkspace();
  if (!workspace) {
    throw new Error('No active workspace');
  }
  return getFileManager(workspace);
}

/**
 * Creates a new file in the specified location
 * Uses File Manager V2 for all workspace types
 * 
 * @param parentPath - Path of the parent folder (with prefix: 'gdrive-', 'local-', or empty for demo)
 * @param fileName - Name of the file to create
 * @throws Error if file creation fails
 */
export async function createFile(parentPath: string, fileName: string): Promise<void> {
  try {
    const manager = getActiveManager();
    const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;
    await manager.createFile(filePath, '');
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
}

/**
 * Creates a new folder in the specified location
 * Uses File Manager V2 for all workspace types
 * 
 * @param parentPath - Path of the parent folder (with prefix)
 * @param folderName - Name of the folder to create
 * @throws Error if folder creation fails
 */
export async function createFolder(parentPath: string, folderName: string): Promise<void> {
  try {
    const manager = getActiveManager();
    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    await manager.createFolder(folderPath);
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
}

/**
 * Deletes a file or folder
 * Uses File Manager V2 for all workspace types
 * 
 * @param nodePath - Path of the node to delete (with prefix)
 * @param isFolder - Whether the node is a folder
 * @throws Error if deletion fails
 */
export async function deleteNode(nodePath: string, isFolder: boolean): Promise<void> {
  try {
    const manager = getActiveManager();
    await manager.deleteFile(nodePath);
  } catch (error) {
    console.error('Error deleting:', error);
    throw error;
  }
}

/**
 * Renames a file or folder
 * Uses File Manager V2 for all workspace types
 * 
 * @param nodePath - Current path of the node
 * @param newName - New name for the node
 * @throws Error if rename fails or not supported
 */
export async function renameNode(nodePath: string, newName: string): Promise<void> {
  try {
    const manager = getActiveManager();
    const pathParts = nodePath.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');

    await manager.renameFile(nodePath, newPath);
  } catch (error) {
    console.error('Error renaming:', error);
    throw error;
  }
}


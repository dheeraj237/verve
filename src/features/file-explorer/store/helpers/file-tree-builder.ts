import { FileNode } from "@/shared/types";
import { MARKDOWN_EXTENSIONS, CODE_EXTENSIONS, TEXT_EXTENSIONS } from "@/shared/utils/file-type-detector";
import { FileManager } from "@/core/file-manager-v2";
import type { FileMetadata } from "@/core/file-manager-v2/types";

/**
 * Builds a file tree from a FileManager adapter
 * Works with Google Drive, local, and other adapters
 * 
 * @param fileManager - FileManager instance
 * @param directory - Directory path to list (empty for root)
 * @param idPrefix - Prefix for node IDs (e.g., 'gdrive-', 'local-')
 * @returns Promise<FileNode[]> - Array of file nodes sorted by type and name
 */
export async function buildFileTreeFromAdapter(
  fileManager: FileManager,
  directory: string = '',
  idPrefix: string = ''
): Promise<FileNode[]> {
  try {
    const files = await fileManager.listFiles(directory);

    const nodes: FileNode[] = files.map((file: FileMetadata) => {
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

      return {
        id: `${idPrefix}${file.id}`,
        name: file.name,
        path: file.path,
        type: isFolder ? 'folder' : 'file',
        // For folders, we'll lazy load children when expanded
        children: isFolder ? [] : undefined,
      };
    });

    return sortFileNodes(nodes);
  } catch (error) {
    console.error('Error building file tree from adapter:', error);
    return [];
  }
}

/**
 * Builds a file tree from a local directory handle
 * 
 * @param handle - FileSystemDirectoryHandle from File System Access API
 * @param path - Current path in the tree (for recursive calls)
 * @returns Promise<FileNode[]> - Array of file nodes sorted by type and name
 * 
 * @example
 * const dirHandle = await window.showDirectoryPicker();
 * const tree = await buildFileTreeFromDirectory(dirHandle);
 */
export async function buildFileTreeFromDirectory(
  handle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  const allowedExtensions = [...MARKDOWN_EXTENSIONS, ...CODE_EXTENSIONS, ...TEXT_EXTENSIONS];
  // @ts-ignore - values() is a valid method on FileSystemDirectoryHandle
  for await (const entry of handle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.kind === 'file') {
      const hasAllowedExt = allowedExtensions.some(ext => entry.name.toLowerCase().endsWith(ext));
      
      if (hasAllowedExt) {
        nodes.push({
          id: `local-file-${entryPath}`,
          name: entry.name,
          path: entryPath,
          type: 'file',
        });
      }
    } else if (entry.kind === 'directory') {
      const children = await buildFileTreeFromDirectory(entry, entryPath);
      if (children.length > 0) {
        nodes.push({
          id: `local-dir-${entryPath}`,
          name: entry.name,
          path: entryPath,
          type: 'folder',
          children,
        });
      }
    }
  }

  return sortFileNodes(nodes);
}

/**
 * Sorts file nodes: folders first, then files, alphabetically
 * 
 * @param nodes - Array of file nodes to sort
 * @returns Sorted array of file nodes
 */
export function sortFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Gets all folder IDs from a file tree recursively
 * Used for expanding all folders in the UI
 * 
 * @param nodes - Array of file nodes to traverse
 * @returns Array of folder IDs
 */
export function getAllFolderIds(nodes: FileNode[]): string[] {
  const ids: string[] = [];
  
  for (const node of nodes) {
    if (node.type === 'folder') {
      ids.push(node.id);
      if (node.children) {
        ids.push(...getAllFolderIds(node.children));
      }
    }
  }
  
  return ids;
}

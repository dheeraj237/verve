import { FileNode } from "@/shared/types";
import { MARKDOWN_EXTENSIONS, CODE_EXTENSIONS, TEXT_EXTENSIONS } from "@/shared/utils/file-type-detector";
import { getAllFiles } from "@/core/cache/file-operations";
import type { FileMetadata } from "@/core/cache";

/**
 * Builds a file tree from RxDB cache
 * Works with all workspace types by reading from the unified RxDB cache
 * 
 * @param directory - Directory path to list (empty for root)
 * @param idPrefix - Prefix for node IDs (e.g., 'gdrive-', 'local-')
 * @param workspaceType - Workspace type to filter cached files by (browser|local|drive|gdrive|s3)
 * @returns Promise<FileNode[]> - Array of file nodes sorted by type and name
 */
export async function buildFileTreeFromAdapter(
  _fileManager: any,  // Kept for backwards compatibility but unused
  directory: string = '',
  idPrefix: string = '',
  workspaceType: string = 'browser',
  workspaceId?: string
): Promise<FileNode[]> {
  try {
    // Get all files from RxDB cache (scoped to workspace when provided)
    const files = await getAllFiles(workspaceId);

    // Normalize workspace type for cache comparison (map 'drive' -> 'gdrive')
    const normalizedWsType = workspaceType === 'drive' ? 'gdrive' : workspaceType;

    // Filter files belonging to the requested workspace type so multiple
    // workspaces (or sample files) don't mix together in the tree.
    let workspaceFiltered = files.filter(f => String(f.workspaceType) === String(normalizedWsType));

    // If a specific workspaceId is provided, further restrict to that workspace
    if (workspaceId) {
      workspaceFiltered = workspaceFiltered.filter(f => f.workspaceId === workspaceId);
    }

    // Filter files based on directory path
    const filteredFiles = filterFilesByDirectory(workspaceFiltered, directory);

    // Check if any files have nested paths (contain '/')
    const hasNestedPaths = filteredFiles.some(f => {
      const pathWithoutLeadingSlash = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      return pathWithoutLeadingSlash.includes('/');
    });

    // If we have nested paths, build a tree structure
    if (hasNestedPaths) {
      return buildTreeFromFlatPaths(filteredFiles, idPrefix);
    }

    // Otherwise, use the simple flat mapping for adapters that return explicit folders
    const nodes: FileNode[] = filteredFiles.map((file: FileMetadata) => {
      const isFolder = file.type === 'dir';

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
    console.error('Error building file tree from cache:', error);
    return [];
  }
}

/**
 * Filters files for a specific directory
 */
function filterFilesByDirectory(files: FileMetadata[], directory: string): FileMetadata[] {
  if (!directory || directory === '' || directory === '/') {
    // At root, return all files — buildTreeFromFlatPaths will construct folders when nested paths exist
    return files;
  }

  const dirPath = directory.replace(/\/$/, ''); // Remove trailing slash
  const prefix = `${dirPath}/`;

  // Return files that start with this directory path
  return files.filter(f => f.path.startsWith(prefix));
}

/**
 * Builds a tree structure from flat file paths
 * Handles nested directories like /content1/file.md
 */
function buildTreeFromFlatPaths(files: FileMetadata[], idPrefix: string = ''): FileNode[] {
  const root: Map<string, any> = new Map();

  files.forEach(file => {
    // Skip files with empty or invalid paths
    if (!file.path || file.path.trim() === '') {
      console.warn('Skipping file with empty path:', file);
      return;
    }

    const pathWithoutLeadingSlash = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    // Filter out empty parts (from double slashes or trailing slashes)
    const parts = pathWithoutLeadingSlash.split('/').filter(p => p.trim() !== '');

    // Skip if no valid parts
    if (parts.length === 0) {
      console.warn('Skipping file with no valid path parts:', file);
      return;
    }

    let currentLevel = root;
    let currentPath = '';

    // Build nested structure (skip the last part which is the file name)
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!currentLevel.has(part)) {
        currentLevel.set(part, {
          isFolder: true,
          path: `/${currentPath}`,
          children: new Map(),
        });
      }

      const folderEntry = currentLevel.get(part);
      // If an entry exists but is a file, we have a path conflict like '/verve.md' vs '/verve.md/nested.md'
      if (folderEntry && folderEntry.isFolder === false) {
        console.warn('Path conflict: expected folder but found file at:', `/${currentPath}`);
        // Skip adding this nested path (don't create a directory under a file)
        return;
      }

      if (!folderEntry || !folderEntry.children) {
        console.error('Invalid folder structure for part:', part);
        return;
      }

      currentLevel = folderEntry.children;
    }

    // Add the file
    const fileName = parts[parts.length - 1];
    if (!fileName || fileName.trim() === '') {
      console.warn('Skipping file with empty filename:', file);
      return;
    }

    currentPath = currentPath ? `${currentPath}/${fileName}` : fileName;

    const existingEntry = currentLevel.get(fileName);
    if (existingEntry) {
      if (existingEntry.isFolder) {
        console.warn('Path conflict: expected file but found folder at:', `/${currentPath}`, 'Skipping file:', file.path);
        return;
      } else {
        // Duplicate file entry — skip
        return;
      }
    }

    currentLevel.set(fileName, {
      isFolder: false,
      path: file.path,
      metadata: file,
    });
  });

  // Convert map structure to FileNode array
  function buildNodes(map: Map<string, any>, basePath: string = ''): FileNode[] {
    const nodes: FileNode[] = [];

    for (const [name, value] of map.entries()) {
      if (value.isFolder) {
        const children = buildNodes(value.children, value.path);
        nodes.push({
          id: `${idPrefix}folder-${value.path}`,
          name,
          path: value.path,
          type: 'folder',
          children,
        });
      } else {
        nodes.push({
          id: `${idPrefix}${value.metadata.id || value.path}`,
          name,
          path: value.path,
          type: 'file',
        });
      }
    }

    return sortFileNodes(nodes);
  }

  return buildNodes(root);
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

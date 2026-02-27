/**
 * Samples File Tree Initializer
 * Loads sample files from RxDB cache into the file explorer
 */

import { FileNode, FileNodeType } from '@/shared/types';
import { getAllFiles } from '@/core/cache/file-operations';

/**
 * Build browser file tree from RxDB cache
 */
export async function buildSamplesFileTree(): Promise<FileNode[]> {
  // Get all files from RxDB cache (only sample workspace)
  const files = await getAllFiles('verve-samples');
  
  // Build a tree structure from flat file list
  const root: { [key: string]: any } = {};
  
  files.forEach(file => {
    const parts = file.path.split('/').filter(Boolean);
    let current = root;
    
    // Build nested structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Add the file
    const fileName = parts[parts.length - 1];
    current[fileName] = {
      ...file,
      isFile: true,
    };
  });
  
  // Convert tree structure to FileNode array
  const buildNodes = (obj: any, basePath: string = ''): FileNode[] => {
    const nodes: FileNode[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const path = basePath ? `${basePath}/${key}` : key;

      // Check if it's a file
      if (value && typeof value === 'object' && 'isFile' in value && (value as any).isFile) {
        nodes.push({
          id: `samples-${path}`,
          name: key,
          path: `/${path}`,
          type: FileNodeType.File,
        });
      } else if (value && typeof value === 'object') {
        // It's a folder
        const children = buildNodes(value, path);
        if (children.length > 0) {
          nodes.push({
            id: `samples-folder-${path}`,
            name: key,
            path: `/${path}`,
            type: FileNodeType.Folder,
            children,
          });
        }
      }
    }
    
    // Sort nodes: directories first, then files, alphabetically within each type
    nodes.sort((a, b) => {
      // Directories before files
      if (a.type === FileNodeType.Folder && b.type === FileNodeType.File) return -1;
      if (a.type === FileNodeType.File && b.type === FileNodeType.Folder) return 1;
      
      // Alphabetically within same type
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    return nodes;
  };
  
  return buildNodes(root);
}

/**
 * Initialize demo file tree in the store
 */
export async function initializeSamplesFileTree(): Promise<FileNode[]> {
  try {
    const fileTree = await buildSamplesFileTree();
    return fileTree;
  } catch (error) {
    console.error('Failed to initialize samples file tree:', error);
    return [];
  }
}

/**
 * Demo File Tree Initializer
 * Loads demo files into the file explorer
 */

import { FileNode } from '@/shared/types';
import { getDemoAdapter } from '@/src/hooks/use-demo-mode';

/**
 * Build demo file tree from demo adapter
 */
export async function buildDemoFileTree(): Promise<FileNode[]> {
  const adapter = getDemoAdapter();
  
  // Organization by category
  const categories: { [key: string]: FileNode[] } = {};
  
  // Get all files from demo adapter
  const tree = await adapter.getFileTree();
  
  // Convert tree to FileNode array
  const buildNodes = (obj: any, basePath: string = ''): FileNode[] => {
    const nodes: FileNode[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const path = basePath ? `${basePath}/${key}` : key;
      
      // Check if it's a file object (has 'content' property)
      if (value && typeof value === 'object' && 'content' in value) {
        nodes.push({
          id: `demo-${path}`,
          name: key,
          path: `/${path}`,
          type: 'file',
        });
      } else if (value && typeof value === 'object') {
        // It's a folder
        const children = buildNodes(value, path);
        if (children.length > 0) {
          nodes.push({
            id: `demo-folder-${path}`,
            name: key,
            path: `/${path}`,
            type: 'folder',
            children,
          });
        }
      }
    }
    
    // Sort nodes: directories first, then files, alphabetically within each type
    nodes.sort((a, b) => {
      // Directories before files
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      
      // Alphabetically within same type
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    return nodes;
  };
  
  return buildNodes(tree);
}

/**
 * Initialize demo file tree in the store
 */
export async function initializeDemoFileTree(): Promise<FileNode[]> {
  try {
    const fileTree = await buildDemoFileTree();
    return fileTree;
  } catch (error) {
    console.error('Failed to initialize demo file tree:', error);
    return [];
  }
}

/**
 * Demo File Tree Initializer
 * Loads demo files into the file explorer
 */

import { FileNode } from '@/shared/types';
import { getDemoAdapter } from '@/hooks/use-demo-mode';

/**
 * Build demo file tree from demo adapter
 */
export async function buildDemoFileTree(): Promise<FileNode[]> {
  const adapter = getDemoAdapter();
  
  // Get all files from demo adapter
  const files = await adapter.listFiles('');
  
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
  
  return buildNodes(root);
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

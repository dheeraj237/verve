import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FileNode } from "@/shared/types";

interface FileExplorerStore {
  expandedFolders: Set<string>;
  selectedFileId: string | null;
  fileTree: FileNode[];
  isLoadingLocalFiles: boolean;
  currentDirectoryName: string | null;
  currentDirectoryPath: string | null;
  toggleFolder: (folderId: string) => void;
  setSelectedFile: (fileId: string | null) => void;
  setFileTree: (tree: FileNode[]) => void;
  openLocalDirectory: () => Promise<void>;
  setIsLoadingLocalFiles: (loading: boolean) => void;
  createFile: (parentPath: string, fileName: string) => Promise<void>;
  createFolder: (parentPath: string, folderName: string) => Promise<void>;
  renameNode: (nodePath: string, newName: string) => Promise<void>;
  deleteNode: (nodePath: string, isFolder: boolean) => Promise<void>;
  refreshFileTree: () => Promise<void>;
  collapseAll: () => void;
  expandAll: () => void;
  toggleCollapseExpand: () => void;
  setCurrentDirectory: (name: string, path: string) => void;
}

export const useFileExplorerStore = create<FileExplorerStore>()(
  persist(
    (set) => ({
      expandedFolders: new Set<string>(),
      selectedFileId: null,
      fileTree: [],
      isLoadingLocalFiles: false,
      currentDirectoryName: null,
      currentDirectoryPath: null,
      toggleFolder: (folderId) =>
        set((state) => {
          const newSet = new Set(state.expandedFolders);
          if (newSet.has(folderId)) {
            newSet.delete(folderId);
          } else {
            newSet.add(folderId);
          }
          return { expandedFolders: newSet };
        }),
      setSelectedFile: (fileId) => set({ selectedFileId: fileId }),
      setFileTree: (tree) => set({ fileTree: tree }),
      setIsLoadingLocalFiles: (loading) => set({ isLoadingLocalFiles: loading }),
      setCurrentDirectory: (name, path) => set({ currentDirectoryName: name, currentDirectoryPath: path }),

      openLocalDirectory: async () => {
        try {
          // Check if File System Access API is supported
          if (!('showDirectoryPicker' in window)) {
            alert('Directory Picker is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
            return;
          }

          set({ isLoadingLocalFiles: true });

          const dirHandle = await (window as any).showDirectoryPicker();

          // Store directory name and path
          const { setCurrentDirectory } = useFileExplorerStore.getState();
          setCurrentDirectory(dirHandle.name, dirHandle.name);

          // Recursively read directory structure
          const buildFileTree = async (handle: any, path: string = ''): Promise<FileNode[]> => {
            const nodes: FileNode[] = [];
            const allowedExtensions = ['.md', '.markdown', '.txt'];

            for await (const entry of handle.values()) {
              const entryPath = path ? `${path}/${entry.name}` : entry.name;

              if (entry.kind === 'file') {
                // Check if file has allowed extension
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
                const children = await buildFileTree(entry, entryPath);
                // Only include directory if it has children
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

            return nodes.sort((a, b) => {
              // Folders first, then files
              if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            });
          };

          const fileTree = await buildFileTree(dirHandle);
          set({ fileTree, expandedFolders: new Set() });

          // Store directory handle for later file reading
          (window as any).__localDirHandle = dirHandle;

        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error opening directory:', error);
            alert('Failed to open directory: ' + (error as Error).message);
          }
        } finally {
          set({ isLoadingLocalFiles: false });
        }
      },

      createFile: async (parentPath: string, fileName: string) => {
        try {
          const isLocal = parentPath.startsWith('local-');

          if (isLocal) {
            // Create local file
            const dirHandle = (window as any).__localDirHandle;
            if (!dirHandle) throw new Error('No directory handle');

            const cleanPath = parentPath.replace(/^local-(file|dir)-/, '');
            const pathParts = cleanPath ? cleanPath.split('/') : [];
            let currentHandle = dirHandle;

            for (const part of pathParts) {
              currentHandle = await currentHandle.getDirectoryHandle(part);
            }

            const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write('');
            await writable.close();
          } else {
            // Create server file
            const fullPath = parentPath ? `${parentPath}/${fileName}` : fileName;
            const response = await fetch(`/api/files/${fullPath}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: '' }),
            });

            if (!response.ok) throw new Error('Failed to create file');
          }

          // Refresh tree
          const { refreshFileTree } = useFileExplorerStore.getState();
          await refreshFileTree();
        } catch (error) {
          console.error('Error creating file:', error);
          throw error;
        }
      },

      createFolder: async (parentPath: string, folderName: string) => {
        try {
          const isLocal = parentPath.startsWith('local-');

          if (isLocal) {
            // Create local folder
            const dirHandle = (window as any).__localDirHandle;
            if (!dirHandle) throw new Error('No directory handle');

            const cleanPath = parentPath.replace(/^local-(file|dir)-/, '');
            const pathParts = cleanPath ? cleanPath.split('/') : [];
            let currentHandle = dirHandle;

            for (const part of pathParts) {
              currentHandle = await currentHandle.getDirectoryHandle(part);
            }

            await currentHandle.getDirectoryHandle(folderName, { create: true });
          } else {
            // Create server folder
            const fullPath = parentPath ? `${parentPath}/${folderName}` : folderName;
            const response = await fetch(`/api/files/${fullPath}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'folder' }),
            });

            if (!response.ok) throw new Error('Failed to create folder');
          }

          // Refresh tree
          const { refreshFileTree } = useFileExplorerStore.getState();
          await refreshFileTree();
        } catch (error) {
          console.error('Error creating folder:', error);
          throw error;
        }
      },

      renameNode: async (nodePath: string, newName: string) => {
        try {
          const isLocal = nodePath.startsWith('local-');

          if (isLocal) {
            alert('Rename is not yet supported for local files via File System Access API');
            return;
          }

          // Server rename
          const response = await fetch(`/api/files/${nodePath}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName }),
          });

          if (!response.ok) throw new Error('Failed to rename');

          // Refresh tree
          const { refreshFileTree } = useFileExplorerStore.getState();
          await refreshFileTree();
        } catch (error) {
          console.error('Error renaming:', error);
          throw error;
        }
      },

      deleteNode: async (nodePath: string, isFolder: boolean) => {
        try {
          const isLocal = nodePath.startsWith('local-');

          if (isLocal) {
            const dirHandle = (window as any).__localDirHandle;
            if (!dirHandle) throw new Error('No directory handle');

            const cleanPath = nodePath.replace(/^local-(file|dir)-/, '');
            const pathParts = cleanPath.split('/');
            const fileName = pathParts.pop();
            let currentHandle = dirHandle;

            for (const part of pathParts) {
              currentHandle = await currentHandle.getDirectoryHandle(part);
            }

            if (isFolder) {
              await currentHandle.removeEntry(fileName!, { recursive: true });
            } else {
              await currentHandle.removeEntry(fileName!);
            }
          } else {
            // Server delete
            const response = await fetch(`/api/files/${nodePath}`, {
              method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete');
          }

          // Refresh tree
          const { refreshFileTree } = useFileExplorerStore.getState();
          await refreshFileTree();
        } catch (error) {
          console.error('Error deleting:', error);
          throw error;
        }
      },

      collapseAll: () => {
        set({ expandedFolders: new Set() });
      },

      expandAll: () => {
        const getAllFolderIds = (nodes: FileNode[]): string[] => {
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
        };

        const state = useFileExplorerStore.getState();
        const allFolderIds = getAllFolderIds(state.fileTree);
        set({ expandedFolders: new Set(allFolderIds) });
      },

      toggleCollapseExpand: () => {
        const state = useFileExplorerStore.getState();
        if (state.expandedFolders.size > 0) {
          // If any folders are expanded, collapse all
          state.collapseAll();
        } else {
          // If all folders are collapsed, expand all
          state.expandAll();
        }
      },

      refreshFileTree: async () => {
        const state = useFileExplorerStore.getState();
        const dirHandle = (window as any).__localDirHandle;

        if (dirHandle) {
          // Refresh local directory
          const { openLocalDirectory } = state;
          // Re-scan the directory
          const buildFileTree = async (handle: any, path: string = ''): Promise<FileNode[]> => {
            const nodes: FileNode[] = [];
            const allowedExtensions = ['.md', '.markdown', '.txt'];

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
                const children = await buildFileTree(entry, entryPath);
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

            return nodes.sort((a, b) => {
              if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            });
          };

          const fileTree = await buildFileTree(dirHandle);
          set({ fileTree });
        } else {
          // Refresh server files
          const response = await fetch('/api/files');
          const result = await response.json();
          if (result.success) {
            set({ fileTree: result.data });
          }
        }
      },
    }),
    {
      name: "file-explorer-storage",
      partialize: (state) => ({
        expandedFolders: Array.from(state.expandedFolders),
        selectedFileId: state.selectedFileId,
        currentDirectoryName: state.currentDirectoryName,
        currentDirectoryPath: state.currentDirectoryPath,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert array back to Set
          state.expandedFolders = new Set(state.expandedFolders as any);
        }
      },
    }
  )
);

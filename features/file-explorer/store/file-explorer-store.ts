import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FileNode } from "@/shared/types";
import { MARKDOWN_EXTENSIONS, CODE_EXTENSIONS, TEXT_EXTENSIONS } from "@/shared/utils/file-type-detector";
import { getDemoAdapter } from "@/src/hooks/use-demo-mode";
import { buildDemoFileTree } from "@/src/utils/demo-file-tree";

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
  setGoogleFolder?: (folderId: string) => void;
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
      setGoogleFolder: (folderId: string) => {
        // store selected Google Drive folder id
        try {
          window.localStorage.setItem('verve_gdrive_folder_id', folderId);
          set({ currentDirectoryName: `Google Drive (${folderId})`, currentDirectoryPath: folderId });
        } catch (e) {
          console.error('Failed to set Google Drive folder', e);
        }
      },

      openLocalDirectory: async () => {
        try {
          // Check if running on iOS
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

          // Check if File System Access API is supported
          if (!('showDirectoryPicker' in window)) {
            if (isIOS) {
              alert('File System Access is not supported on iOS. Please use a Chromium-based browser on desktop (Chrome, Edge, Brave) to access your local files. The app currently supports reading the default content folder on all devices.');
            } else {
              alert('Directory Picker is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
            }
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
            const allowedExtensions = [...MARKDOWN_EXTENSIONS, ...CODE_EXTENSIONS, ...TEXT_EXTENSIONS];

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

          if (parentPath.startsWith('gdrive-')) {
            // Create file in Google Drive folder or subfolder
            const folderId = parentPath.replace(/^gdrive-/, '');
            const token = await (await import('@/core/auth/google')).requestDriveAccessToken(true);
            if (!token) throw new Error('Not authenticated with Google Drive');
            // create new file via Drive upload multipart
            const metadata = { name: fileName, parents: [folderId] };
            const boundary = '-------314159265358979323846';
            const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n\r\n--${boundary}--`;
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
              body: multipart,
            });
            if (!res.ok) throw new Error('Failed to create file on Google Drive');
            // Refresh tree below
          } else if (isLocal) {
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
            // Create demo file using demo adapter (localStorage)
            const adapter = getDemoAdapter();
            const fullPath = parentPath ? `${parentPath}/${fileName}` : `/${fileName}`;
            await adapter.createFile(fullPath, '', parentPath || 'demo');
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

          if (parentPath.startsWith('gdrive-')) {
            // Create folder in Google Drive
            const folderId = parentPath.replace(/^gdrive-/, '');
            const { requestDriveAccessToken } = await import('@/core/auth/google');
            const token = await requestDriveAccessToken(true);
            if (!token) throw new Error('Not authenticated with Google Drive');
            const metadata = { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [folderId] };
            const res = await fetch('https://www.googleapis.com/drive/v3/files', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(metadata),
            });
            if (!res.ok) throw new Error('Failed to create folder on Google Drive');
          } else if (isLocal) {
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
            // Create demo folder - create a placeholder file to represent the folder
            const adapter = getDemoAdapter();
            const fullPath = parentPath ? `${parentPath}/${folderName}/.keep` : `/${folderName}/.keep`;
            await adapter.createFile(fullPath, '', parentPath || 'demo');
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

          // Demo rename - read, delete, create with new name
          const adapter = getDemoAdapter();
          const fileData = await adapter.readFile(nodePath);
          await adapter.deleteFile(nodePath);

          const pathParts = nodePath.split('/');
          pathParts[pathParts.length - 1] = newName;
          const newPath = pathParts.join('/');

          await adapter.createFile(newPath, fileData.content, fileData.category);

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

          if (nodePath.startsWith('gdrive-')) {
            // Delete a file or folder in Google Drive. nodePath is 'gdrive-<id>' or 'gdrive-<id>/sub...'
            const idPart = nodePath.replace(/^gdrive-/, '');
            const parts = idPart.split('/');
            const targetId = parts[0];
            const { requestDriveAccessToken } = await import('@/core/auth/google');
            const token = await requestDriveAccessToken(true);
            if (!token) throw new Error('Not authenticated with Google Drive');

            const deleteFile = async (fileId: string) => {
              await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
            };

            if (isFolder) {
              // Recursively list and delete children
              const listChildren = async (parentId: string): Promise<string[]> => {
                const out: string[] = [];
                let pageToken: string | null = null;
                do {
                  const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
                  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,mimeType)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
                  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                  if (!resp.ok) break;
                  const json = await resp.json();
                  for (const f of json.files || []) {
                    out.push(f.id);
                    if (f.mimeType === 'application/vnd.google-apps.folder') {
                      const child = await listChildren(f.id);
                      out.push(...child);
                    }
                  }
                  pageToken = json.nextPageToken || null;
                } while (pageToken);
                return out;
              };

              const all = await listChildren(targetId);
              for (const fid of all) {
                await deleteFile(fid);
              }
              await deleteFile(targetId);
            } else {
              await deleteFile(targetId);
            }
          } else if (isLocal) {
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
            // Demo delete using demo adapter
            const adapter = getDemoAdapter();
            if (isFolder) {
              // For folders, delete all files that start with this path
              const tree = await adapter.getFileTree();
              const getAllFiles = (obj: any, basePath: string = ''): string[] => {
                const files: string[] = [];
                for (const [key, value] of Object.entries(obj)) {
                  const path = basePath ? `${basePath}/${key}` : key;
                  if (value && typeof value === 'object' && 'content' in value) {
                    files.push(`/${path}`);
                  } else if (value && typeof value === 'object') {
                    files.push(...getAllFiles(value, path));
                  }
                }
                return files;
              };
              const allFiles = getAllFiles(tree);
              const filesToDelete = allFiles.filter(f => f.startsWith(nodePath));
              for (const file of filesToDelete) {
                await adapter.deleteFile(file);
              }
            } else {
              await adapter.deleteFile(nodePath);
            }
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
          // If user has selected a Google Drive folder, load it
          const gdriveFolder = window.localStorage.getItem('verve_gdrive_folder_id');
          if (gdriveFolder) {
            try {
              // Do not attempt to silently list Drive files (avoids requesting extra scopes).
              // Instead, show the connected Verve folder and the pre-created verve.md if available.
              const verveFileId = window.localStorage.getItem('verve_gdrive_verve_file_id');
              const children: FileNode[] = [];
              if (verveFileId) {
                children.push({ id: `gdrive-${verveFileId}`, name: 'verve.md', path: verveFileId, type: 'file' });
              }
              const nodes: FileNode[] = [
                { id: `gdrive-${gdriveFolder}`, name: 'Google Drive (Verve)', path: gdriveFolder, type: 'folder', children },
              ];
              set({ fileTree: nodes });
            } catch (e) {
              console.error('Failed to load Google Drive folder', e);
              const fileTree = await buildDemoFileTree();
              set({ fileTree });
            }
          } else {
            // Refresh demo files from localStorage
            const fileTree = await buildDemoFileTree();
            set({ fileTree });
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

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FileNode, FileType } from "@/shared/types";
import { WorkspaceType } from '@/core/cache/types';
import { buildSamplesFileTree } from "@/utils/demo-file-tree";
import { getAllFiles, saveFile, createDirectory, renameFile, deleteFile, loadSampleFilesFromFolder, upsertCachedFile, subscribeToWorkspaceFiles, getWorkspaceTree, saveFileNode, deleteFileNode, queryByPath } from '@/core/cache/file-manager';
import { useWorkspaceStore } from "@/core/store/workspace-store";

/**
 * File Explorer Store State
 * Manages the file tree, expanded folders, and selected file
 */
interface FileExplorerStore {
  expandedFolders: Set<string>;
  selectedFileId: string | null;
  // Canonical map: id -> FileNode (children as ids for directories)
  fileMap: Record<string, FileNode>;
  rootIds: string[];
  isLoadingLocalFiles: boolean;
  isSyncingDrive: boolean;
  currentDirectoryName: string | null;
  currentDirectoryPath: string | null;
  pendingSyncCount: number;

  toggleFolder: (folderId: string) => void;
  setSelectedFile: (fileId: string | null) => void;
  setIsLoadingLocalFiles: (loading: boolean) => void;
  setIsSyncingDrive: (loading: boolean) => void;
  setCurrentDirectory: (name: string, path: string) => void;
  setPendingSyncCount: (count: number) => void;

  openLocalDirectory: (workspaceId?: string) => Promise<void>;
  restoreLocalDirectory: (workspaceId: string) => Promise<boolean>;
  requestPermissionForWorkspace: (workspaceId: string) => Promise<boolean>;

  // Internal helpers (used by store methods)
  _replaceChildrenInTree: (nodes: FileNode[], dirPath: string, newChildren: FileNode[]) => { tree: FileNode[]; replaced: boolean };
  _updateFileTreeForDirectory: (dirPath: string) => Promise<void>;
  _buildFileTreeFromCache: (workspaceId?: string) => Promise<FileNode[]>;
  // Selectors for map-based API
  getChildren: (id: string) => string[];
  getPath: (id: string) => string | null;
  isDirty: (id: string) => boolean;
  getFileTree: () => FileNode[];
  createFile: (parentPath: string, fileName: string) => Promise<void>;
  createFolder: (parentPath: string, folderName: string) => Promise<void>;
  renameNode: (nodePath: string, newName: string) => Promise<void>;
  deleteNode: (nodePath: string, isFolder: boolean) => Promise<void>;

  refreshFileTree: () => Promise<void>;
  collapseAll: () => void;
  expandAll: () => void;
  toggleCollapseExpand: () => void;
  clearLocalDirectory: () => void;

  setGoogleFolder?: (folderId: string) => void;
}

/**
 * File Explorer Store Implementation
 * Central state management for file tree navigation and operations
 */
export const useFileExplorerStore = create<FileExplorerStore>()(
  persist(
    (set, get) => ({

      expandedFolders: new Set<string>(),
      selectedFileId: null,
      fileMap: {},
      rootIds: [],
      isLoadingLocalFiles: false,
      isSyncingDrive: false,
      currentDirectoryName: null,
      currentDirectoryPath: null,
      pendingSyncCount: 0,

          /** Toggles a folder's expanded/collapsed state */
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

      /** Sets the currently selected file */
      setSelectedFile: (fileId) => set({ selectedFileId: fileId }),

      getChildren: (id: string) => {
        const state = get();
        const node = state.fileMap?.[id];
        if (!node) return [];
        return (node.children as any) || [];
      },
      /**
       * Reconstruct nested object tree from canonical `fileMap` + `rootIds`.
       * This is computed on demand to avoid storing heavy derived state.
       */
      getFileTree: () => {
        const state = get();
        const map = state.fileMap || {};
        const roots = state.rootIds || [];

        function buildNode(id: string): FileNode | null {
          const n = map[id];
          if (!n) return null;
          const copy: FileNode = { ...n } as any;
          const childIds = (n as any).children || [];
          if (childIds && childIds.length) {
            const childNodes = childIds.map((cid: string) => buildNode(cid)).filter(Boolean) as FileNode[];
            // Sort children: directories before files, alphabetically within each type
            childNodes.sort((a, b) => {
              if (a.type === FileType.Directory && b.type === FileType.File) return -1;
              if (a.type === FileType.File && b.type === FileType.Directory) return 1;
              return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            });
            copy.children = childNodes;
          } else {
            delete (copy as any).children;
          }
          return copy;
        }

        const tree = roots.map(rid => buildNode(rid)).filter(Boolean) as FileNode[];
        // Sort root nodes: directories before files, alphabetically within each type
        tree.sort((a, b) => {
          if (a.type === FileType.Directory && b.type === FileType.File) return -1;
          if (a.type === FileType.File && b.type === FileType.Directory) return 1;
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
        return tree;
      },
      getPath: (id: string) => {
        const state = get();
        const node = state.fileMap?.[id];
        return node?.path ?? null;
      },
      isDirty: (id: string) => {
        const state = get();
        const node = state.fileMap?.[id];
        return !!(node && (node as any).dirty);
      },

      /** Sets the loading state for local files */
      setIsLoadingLocalFiles: (loading) => set({ isLoadingLocalFiles: loading }),
      setIsSyncingDrive: (loading) => set({ isSyncingDrive: loading }),

      setCurrentDirectory: (name, path) => set({ currentDirectoryName: name, currentDirectoryPath: path }),

      setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
      setGoogleFolder: (folderId: string) => {
        try {
          window.localStorage.setItem('verve_gdrive_folder_id', folderId);
          // Prefer showing the active workspace name (user-specific) when available
          try {
            const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
            const name = activeWs?.name ?? `Google Drive`;
            set({ currentDirectoryName: name, currentDirectoryPath: folderId });
          } catch (err) {
            set({ currentDirectoryName: `Google Drive`, currentDirectoryPath: folderId });
          }
        } catch (e) {
          console.error('Failed to set Google Drive folder', e);
        }
      },

      // Replace children for a directory path in a nested FileNode tree
      _replaceChildrenInTree: (nodes: FileNode[], dirPath: string, newChildren: FileNode[]) => {
        let replaced = false;
        function walk(list: FileNode[]): FileNode[] {
          return list.map((n) => {
            if (n.path === dirPath) {
              replaced = true;
              return { ...n, children: newChildren } as FileNode;
            }
            if (n.children && n.children.length) {
              return { ...n, children: walk(n.children) } as FileNode;
            }
            return n;
          });
        }
        const tree = walk(nodes);
        return { tree, replaced };
      },

      // Helper: normalize paths for comparison (strip leading/trailing slashes)
      normalizePathForCompare: (p: string) => {
        if (!p) return '';
        return p.replace(/^\/*/, '').replace(/\/*$/, '');
      },

      // Update the canonical fileMap/rootIds by rebuilding from cache
      _updateFileTreeForDirectory: async (dirPath: string) => {
        const activeWs = useWorkspaceStore.getState().activeWorkspace();
        if (!activeWs) return;
        try {
          // Rebuild the canonical fileMap/rootIds by scanning the cache
          await (get() as any)._buildFileTreeFromCache(activeWs.id);
          set({ currentDirectoryName: activeWs.name, currentDirectoryPath: '/' });
        } catch (e) {
          console.error('Failed to update file tree for directory', dirPath, e);
          // fallback to full refresh
          await get().refreshFileTree();
        }
      },

      // Build a file tree from RxDB cache entries for a workspace
      _buildFileTreeFromCache: async (workspaceId?: string): Promise<FileNode[]> => {
        try {
          const files = await getAllFiles(workspaceId);

          // Normalize and sort paths so directories come before children
          const map: Record<string, FileNode> = {};
          const roots: FileNode[] = [];
          const rootIdsLocal: string[] = [];

          // Build a lookup of directory ids from cached files (so folder nodes use DB ids when present)
          const dirIdByPath: Record<string, string> = {};
          for (const f of files) {
            if (f.type === FileType.Directory) {
              const p = (f.path || '').replace(/^\/*/, '').replace(/\/*$/, '');
              dirIdByPath[p] = f.id;
            }
          }

          function ensureNode(pathSegments: string[], fullPath: string): FileNode {
            const nodePath = fullPath;
            if (map[nodePath]) return map[nodePath];

            const name = pathSegments[pathSegments.length - 1] || '';
            const id = dirIdByPath[nodePath] || `node-${nodePath}`;
            const node: FileNode = { id, name, path: nodePath, type: FileType.Directory, children: [] };
            map[nodePath] = node;
            return node;
          }

          for (const f of files) {
            const raw = f.path || '';
            const normalized = raw.replace(/^\/*/, '').replace(/\/*$/, '');
            const parts = normalized === '' ? [] : normalized.split('/');

            // Build parent folders. For files we only create folders for the
            // path segments *before* the filename (i < parts.length - 1). For
            // directory entries we create nodes for all segments.
            let accum = '';
            let parent: FileNode | null = null;
            const isDir = f.type === FileType.Directory || (String(f.type).toLowerCase() === 'directory');
            const loopEnd = isDir ? parts.length : Math.max(0, parts.length - 1);
            for (let i = 0; i < loopEnd; i++) {
              accum = parts.slice(0, i + 1).join('/');
              const node = map[accum] || ensureNode(parts.slice(0, i + 1), accum);
              if (i === 0) {
                if (!roots.find(r => r.path === node.path)) {
                  roots.push(node);
                  if (!rootIdsLocal.includes(node.id)) rootIdsLocal.push(node.id);
                }
              }
              if (parent && parent.children) {
                if (!parent.children.find(c => c.path === node.path)) parent.children.push(node);
              }
              parent = node;
            }

            // If file is a directory, ensure it exists
            if (f.type === FileType.Directory) {
              const dirPath = normalized;
              if (!map[dirPath]) {
                const dirNode = ensureNode(parts.length ? parts : [''], dirPath);
                if (!parent && dirNode && !roots.find(r => r.path === dirNode.path)) {
                  roots.push(dirNode);
                  rootIdsLocal.push(dirNode.id);
                }
              }
              continue;
            }

            // It's a file - create a file node under parent
            const fileName = parts[parts.length - 1] || f.name;
            const filePath = normalized;
            const fileNode: FileNode = { id: f.id, name: fileName, path: filePath, type: FileType.File };

            if (parent) {
              parent.children = parent.children || [];
              if (!parent.children.find(c => c.path === fileNode.path)) parent.children.push(fileNode);
            } else {
              // file at root
              if (!roots.find(r => r.path === fileNode.path)) {
                roots.push(fileNode);
                rootIdsLocal.push(fileNode.id);
              }
            }
          }

          // Remove any duplicates and ensure children arrays exist
          function tidy(list: FileNode[]): FileNode[] {
            return list.map(n => ({ ...n, children: n.children && n.children.length ? tidy(n.children) : [] }));
          }

          // Build fileMap with children as id arrays
          function buildMap(list: FileNode[]) {
            for (const node of list) {
              const copy = { ...node } as FileNode;
              if (copy.children && copy.children.length) {
                const childIds = copy.children.map(c => c.id);
                (copy as any).children = childIds;
                map[copy.id] = copy;
                // recurse on original children objects
                buildMap(node.children || []);
              } else {
                delete (copy as any).children;
                map[copy.id] = copy;
              }
            }
          }

          const tidyRoots = tidy(roots);
          // Ensure directories are listed before files and sort alphabetically
          function sortNodes(list: FileNode[]) {
            list.sort((a, b) => {
              if (a.type === FileType.Directory && b.type === FileType.File) return -1;
              if (a.type === FileType.File && b.type === FileType.Directory) return 1;
              return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            });
            for (const n of list) {
              if (n.children && n.children.length) sortNodes(n.children);
            }
          }

          sortNodes(tidyRoots);
          buildMap(tidyRoots);

          // Persist map and root ids into state
          // Clean map: ensure only id-keyed entries remain (remove any path-keyed temporary entries)
          const cleanedMap: Record<string, FileNode> = {};
          for (const k of Object.keys(map)) {
            const node = map[k];
            if (node && node.id && String(node.id) === String(k)) {
              cleanedMap[k] = node;
            }
          }

          set({ fileMap: cleanedMap, rootIds: rootIdsLocal });

          return tidyRoots;
        } catch (e) {
          console.error('Failed to build file tree from cache', e);
          return [];
        }
      },

      /**
       * Opens a local directory using the File System Access API
       * @param workspaceId - Optional workspace ID for persisting the directory handle
       */
      openLocalDirectory: async (workspaceId?: string) => {
        try {
          set({ isLoadingLocalFiles: true });
          const { openLocalDirectory: wsOpenLocalDirectory } = await import('@/core/cache/workspace-manager');
          try {
            await wsOpenLocalDirectory(workspaceId);
          } catch (err) {
            console.warn('openLocalDirectory failed, falling back to cache refresh', err);
            // fallback to cache refresh
            await get().refreshFileTree();
            const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
            set({ expandedFolders: new Set(), currentDirectoryName: activeWs?.name ?? null, currentDirectoryPath: '/' });
          }
        } catch (error) {
          console.error('Error opening directory (cache-only):', error);
        } finally {
          set({ isLoadingLocalFiles: false });
        }
      },

      /**
       * Restores a previously opened local directory from storage
       * @param workspaceId - Workspace ID used when the directory was originally opened
       * @returns true if directory was restored successfully, false otherwise
       */
      restoreLocalDirectory: async (workspaceId: string): Promise<boolean> => {
        try {
          set({ isLoadingLocalFiles: true });
          const { requestPermissionForLocalWorkspace } = await import('@/core/cache/workspace-manager');
          const ok = await requestPermissionForLocalWorkspace(workspaceId);
          if (!ok) {
            await get().refreshFileTree();
            return false;
          }
          await get().refreshFileTree();
          return true;
        } catch (error) {
          console.error('Error restoring directory (cache-only):', error);
          return false;
        } finally {
          set({ isLoadingLocalFiles: false });
        }
      },

      /**
       * Prompt the user to re-grant permission for a stored local workspace.
       * This must be invoked from a user gesture to avoid SecurityError.
       */
      requestPermissionForWorkspace: async (workspaceId: string): Promise<boolean> => {
        try {
          set({ isLoadingLocalFiles: true });
          const { requestPermissionForLocalWorkspace } = await import('@/core/cache/workspace-manager');
          const ok = await requestPermissionForLocalWorkspace(workspaceId);
          await get().refreshFileTree();
          return !!ok;
        } catch (error) {
          console.error('Error requesting permission (cache-only):', error);
          return false;
        } finally {
          set({ isLoadingLocalFiles: false });
        }
      },

      /**
       * Creates a new file in the specified parent folder
       * @param parentPath - Path of the parent folder (with appropriate prefix)
       * @param fileName - Name of the new file
       */
      createFile: async (parentPath: string, fileName: string) => {
        try {
          const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;
          const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
          // Use file-manager to create file (handles sync internally if needed)
          await saveFile(filePath, '', activeWs?.type ?? WorkspaceType.Browser, { mimeType: 'text/markdown' }, activeWs?.id);
          await get()._updateFileTreeForDirectory(parentPath || '');
        } catch (error) {
          console.error('Error creating file (cache-only):', error);
          throw error;
        }
      },

      /**
       * Creates a new folder in the specified parent folder
       * @param parentPath - Path of the parent folder (with appropriate prefix)
       * @param folderName - Name of the new folder
       */
      createFolder: async (parentPath: string, folderName: string) => {
        try {
          const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
          const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
          await createDirectory(folderPath, activeWs?.type ?? WorkspaceType.Browser, activeWs?.id);
          await get()._updateFileTreeForDirectory(parentPath || '');
        } catch (error) {
          console.error('Error creating folder (cache-only):', error);
          throw error;
        }
      },

      /** Renames a file or folder */
      renameNode: async (nodePath: string, newName: string) => {
        try {
          const parentPath = nodePath.includes('/') ? nodePath.replace(/\/[^\/]+$/, '') : '';
          const newPath = parentPath ? `${parentPath}/${newName}` : newName;
          const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
          await renameFile(nodePath, newPath, activeWs?.id);
          await get()._updateFileTreeForDirectory(parentPath || '');
        } catch (error) {
          console.error('Error renaming (cache-only):', error);
          throw error;
        }
      },

      /**
       * Deletes a file or folder
       * @param nodePath - Path of the node to delete
       * @param isFolder - Whether the node is a folder
       */
      deleteNode: async (nodePath: string, isFolder: boolean) => {
        try {
          const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
          await deleteFile(nodePath, activeWs?.id);
          const parentPath = nodePath.includes('/') ? nodePath.replace(/\/[^\/]+$/, '') : '';
          await get()._updateFileTreeForDirectory(parentPath || '');
        } catch (error) {
          console.error('Error deleting (cache-only):', error);
          throw error;
        }
      },

      /** Collapses all folders in the tree */
      collapseAll: () => {
        set({ expandedFolders: new Set() });
      },

      /** Expands all folders in the tree */
      expandAll: () => {
        const state = get();
        const map = state.fileMap || {};
        const roots = state.rootIds || [];
        let allFolderIds: string[] = [];

        const visited = new Set<string>();
        function walkId(id?: string) {
          if (!id || visited.has(id)) return;
          visited.add(id);
          const node = map[id];
          if (!node) return;
          if (node.type === FileType.Directory) {
            allFolderIds.push(node.id);
            const children = (node as any).children || [];
            for (const cid of children) walkId(cid);
          }
        }

        for (const rid of roots) walkId(rid);
        set({ expandedFolders: new Set(allFolderIds) });
      },

      /** Toggles between expand all and collapse all */
      toggleCollapseExpand: () => {
        const state = get();
        if (state.expandedFolders.size > 0) {
          state.collapseAll();
        } else {
          state.expandAll();
        }
      },

      /** Refreshes the file tree from RxDB cache */
      refreshFileTree: async () => {
        const state = get();

        // Get the active workspace to determine which file tree to load
        const activeWorkspace = useWorkspaceStore.getState().activeWorkspace();

        // If no workspace is active, show empty
        if (!activeWorkspace) {
          set({ currentDirectoryName: null, currentDirectoryPath: null });
          return;
        }

        // For the verve-samples workspace prefer the canonical cache builder
        if (activeWorkspace.type === WorkspaceType.Browser && activeWorkspace.id === 'verve-samples') {
          try {
            // First try building from the RxDB cache (this will pick up test-upserted entries)
            const treeFromCache = await (get() as any)._buildFileTreeFromCache(activeWorkspace.id);
            if (treeFromCache && treeFromCache.length > 0) {
              set({ currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/samples' });
              return;
            }

            // Fallback: attempt to load sample files via the helper (browser fetch or test mock)
            await buildSamplesFileTree();
            set({ currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/samples' });
          } catch (e) {
            console.error('Failed to load verve-samples workspace files', e);
            set({ currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/samples' });
          }
          return;
        }

        try {
          await (get() as any)._buildFileTreeFromCache(activeWorkspace.id);
          set({ currentDirectoryName: activeWorkspace.name, currentDirectoryPath: '/' });
        } catch (e) {
          console.error('Failed to load workspace files from cache', e);
          set({ currentDirectoryName: activeWorkspace.name, currentDirectoryPath: '/' });
        }
      },

      /** Overwrite the `verve-samples` workspace by clearing and reloading sample files */
      reloadSampleWorkspace: async () => {
        try {
          // Delete existing sample entries (RxDB only) then reload via browser fetch
          try {
            const existing = await getAllFiles('verve-samples');
            for (const f of existing) {
              try {
                await deleteFile(f.path, 'verve-samples');
              } catch (e) {
                console.warn('Failed to delete sample child during reload:', e);
              }
            }
          } catch (e) {
            console.warn('Failed to enumerate existing sample files for reload:', e);
          }

          await loadSampleFilesFromFolder();
          set({ currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/samples' });
        } catch (e) {
          console.error('Failed to reload verve-samples workspace files', e);
        }
      },

      /** Clears the currently open local directory */
      clearLocalDirectory: () => {
        set({ currentDirectoryName: null, currentDirectoryPath: null, expandedFolders: new Set() });
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
            // Restore expandedFolders as a Set
            state.expandedFolders = new Set(state.expandedFolders as any);
          }
      },
    }
  )
);

// Listen for Drive changes and refresh the tree
if (typeof window !== 'undefined') {
  window.addEventListener('verve:gdrive:changed', () => {
    try {
      useFileExplorerStore.getState().refreshFileTree();
    } catch (e) {
      // ignore
    }
  });
}

// Subscribe to workspace file changes and refresh the explorer when files change.
try {
  let currentWsId = useWorkspaceStore.getState().activeWorkspace?.()?.id ?? null;
  let unsubFiles = subscribeToWorkspaceFiles(currentWsId, async () => {
    try { await useFileExplorerStore.getState().refreshFileTree(); } catch (e) { /* ignore */ }
  });

  const unsubWorkspace = (useWorkspaceStore.subscribe as any)(s => s.activeWorkspaceId, (newId) => {
    try { unsubFiles(); } catch (_) { }
    currentWsId = newId ?? null;
    unsubFiles = subscribeToWorkspaceFiles(currentWsId, async () => {
      try { await useFileExplorerStore.getState().refreshFileTree(); } catch (e) { /* ignore */ }
    });
  });

  // Clean up on window unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      try { unsubFiles(); } catch (_) { }
      try { unsubWorkspace(); } catch (_) { }
    });
  }
} catch (e) {
  // ignore subscription failures
}

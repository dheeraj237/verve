import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FileNode, FileNodeType } from "@/shared/types";
import { WorkspaceType, FileType } from '@/core/cache/types';
import { buildSamplesFileTree } from "@/utils/demo-file-tree";
import { getAllFiles, saveFile, createDirectory, renameFile, deleteFile, loadSampleFilesFromFolder } from '@/core/cache/file-manager';
import { upsertCachedFile } from '@/core/cache/rxdb';
import { CachedFile, FileType as CacheFileType } from '@/core/cache/types';
import { subscribeToWorkspaceFiles } from '@/core/cache/file-manager';
import { getAllFolderIds } from "./helpers/file-tree-builder";
import { useWorkspaceStore } from "@/core/store/workspace-store";

/**
 * File Explorer Store State
 * Manages the file tree, expanded folders, and selected file
 */
interface FileExplorerStore {
  expandedFolders: Set<string>;
  selectedFileId: string | null;
  fileTree: FileNode[];
  // New canonical map: id -> FileNode (children as ids for directories)
  fileMap: Record<string, FileNode>;
  rootIds: string[];
  isLoadingLocalFiles: boolean;
  isSyncingDrive: boolean;
  currentDirectoryName: string | null;
  currentDirectoryPath: string | null;
  pendingSyncCount: number;

  toggleFolder: (folderId: string) => void;
  setSelectedFile: (fileId: string | null) => void;
  setFileTree: (tree: FileNode[]) => void;
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
      fileTree: [],
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

      /** Updates the entire file tree */
      setFileTree: (tree) => set({ fileTree: tree }),
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
            copy.children = childIds.map((cid: string) => buildNode(cid)).filter(Boolean) as FileNode[];
          } else {
            delete (copy as any).children;
          }
          return copy;
        }

        return roots.map(rid => buildNode(rid)).filter(Boolean) as FileNode[];
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

      // Helper: normalize paths for comparison (strip leading/trailing slashes)
      normalizePathForCompare: (p: string) => {
        if (!p) return '';
        return p.replace(/^\/*/, '').replace(/\/*$/, '');
      },

      // Internal helper to replace children of a folder node matching dirPath
      _replaceChildrenInTree: (nodes: FileNode[], dirPath: string, newChildren: FileNode[]): { tree: FileNode[]; replaced: boolean } => {
        let replaced = false;

        function norm(p: string) {
          if (!p) return '';
          return p.replace(/^\/*/, '').replace(/\/*$/, '');
        }

        function recurse(list: FileNode[]): FileNode[] {
          return list.map(node => {
            const nodePath = norm(node.path || '');
            if (nodePath === norm(dirPath) && node.type === FileNodeType.Folder) {
              replaced = true;
              return { ...node, children: newChildren };
            }
            if (node.children && node.children.length > 0) {
              return { ...node, children: recurse(node.children) };
            }
            return node;
          });
        }

        const newTree = recurse(nodes);
        return { tree: newTree, replaced };
      },

      // Update only the affected directory in the UI by reading RxDB for that dir
      _updateFileTreeForDirectory: async (dirPath: string) => {
        const activeWs = useWorkspaceStore.getState().activeWorkspace();
        if (!activeWs) return;
        try {
          // Rebuild the canonical fileMap/rootIds by scanning the cache first.
          // `_buildFileTreeFromCache` updates `fileMap` and `rootIds` in state as a side-effect
          const tree = await (get() as any)._buildFileTreeFromCache(activeWs.id);

          // If dirPath is root, replace whole tree
          const normalized = dirPath ? dirPath.replace(/^\/*/, '').replace(/\/*$/, '') : '';
          if (!normalized) {
            set({ fileTree: tree, currentDirectoryName: activeWs.name, currentDirectoryPath: '/' });
            return;
          }

          const currentTree = get().fileTree || [];
          const { tree: updatedTree, replaced } = get()._replaceChildrenInTree(currentTree, dirPath, tree);
          if (replaced) {
            // Ensure the canonical map/rootIds stay in sync with the rebuilt cache
            const currentMap = get().fileMap;
            const currentRootIds = get().rootIds;
            set({ fileTree: updatedTree, fileMap: currentMap, rootIds: currentRootIds });
            return;
          }

          // Parent folder not found in current tree — fall back to full rebuild
          set({ fileTree: tree, currentDirectoryName: activeWs.name, currentDirectoryPath: '/' });
        } catch (e) {
          console.error('Failed to update file tree for directory', dirPath, e);
          // fallback
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
            if (f.type === FileType.Dir) {
              const p = (f.path || '').replace(/^\/*/, '').replace(/\/*$/, '');
              dirIdByPath[p] = f.id;
            }
          }

          function ensureNode(pathSegments: string[], fullPath: string): FileNode {
            const nodePath = fullPath;
            if (map[nodePath]) return map[nodePath];

            const name = pathSegments[pathSegments.length - 1] || '';
            const id = dirIdByPath[nodePath] || `node-${nodePath}`;
            const node: FileNode = { id, name, path: nodePath, type: FileNodeType.Folder, children: [] };
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
            const isDir = f.type === FileType.Dir || (String(f.type).toLowerCase() === 'dir');
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
            if (f.type === FileType.Dir) {
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
            const fileNode: FileNode = { id: f.id, name: fileName, path: filePath, type: FileNodeType.File };

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
              if (a.type === FileNodeType.Folder && b.type === FileNodeType.File) return -1;
              if (a.type === FileNodeType.File && b.type === FileNodeType.Folder) return 1;
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
          const sm = await import('@/core/sync/sync-manager');
          try {
            await sm.getSyncManager().requestOpenLocalDirectory(workspaceId);
          } catch (err) {
            console.warn('requestOpenLocalDirectory failed, falling back to cache refresh', err);
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
          const sm = await import('@/core/sync/sync-manager');
          const ok = await sm.getSyncManager().requestPermissionForLocalWorkspace(workspaceId);
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
          const sm = await import('@/core/sync/sync-manager');
          const ok = await sm.getSyncManager().requestPermissionForLocalWorkspace(workspaceId);
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
          // If this is a Local workspace and a directory handle/adapter is available,
          // create the file on disk first so the FS remains authoritative.
          if (activeWs && activeWs.type === WorkspaceType.Local) {
            try {
              const sm = await import('@/core/sync/sync-manager');
              const localAdapter = sm.getSyncManager().getAdapter('local');
              const workspaceId = activeWs.id;
              if (localAdapter && typeof (localAdapter as any).isReady === 'function' && (localAdapter as any).isReady()) {
                const fileMeta: any = {
                  id: filePath,
                  name: fileName,
                  path: filePath,
                  type: CacheFileType.File,
                  workspaceType: WorkspaceType.Local,
                  workspaceId: workspaceId,
                } as CachedFile;
                try {
                  await (localAdapter as any).push(fileMeta, '');
                } catch (pe) {
                  console.warn('Local adapter push failed for createFile, falling back to cache-only', pe);
                }
                // Persist to RxDB so file-explorer can rebuild from cache
                await saveFile(filePath, '', activeWs?.type ?? WorkspaceType.Browser, { mimeType: 'text/markdown' }, workspaceId);
                await get()._updateFileTreeForDirectory(parentPath || '');
                return;
              }
            } catch (e) {
              console.warn('Failed to create file on local adapter, falling back to cache-only', e);
            }
          }

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
        // Prefer using the canonical `fileTree` if present, otherwise build
        // folders list from `rootIds` + `fileMap` so expand all works when
        // rendering uses `rootIds`/`fileMap` instead of `fileTree`.
        let allFolderIds: string[] = [];

        if (state.fileTree && state.fileTree.length > 0) {
          allFolderIds = getAllFolderIds(state.fileTree);
        } else {
          // Walk the map starting at rootIds to collect folder ids
          const visited = new Set<string>();
          const map = state.fileMap || {};

          function walkId(id?: string) {
            if (!id || visited.has(id)) return;
            visited.add(id);
            const node = map[id];
            if (!node) return;
            if (node.type === 'folder') {
              allFolderIds.push(node.id);
              const children = (node as any).children || [];
              for (const cid of children) walkId(cid);
            }
          }

          const roots = state.rootIds || [];
          for (const rid of roots) walkId(rid);
        }

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
          set({ fileTree: [], currentDirectoryName: null, currentDirectoryPath: null });
          return;
        }

        // For the verve-samples workspace prefer the canonical cache builder
        if (activeWorkspace.type === WorkspaceType.Browser && activeWorkspace.id === 'verve-samples') {
          try {
            // First try building from the RxDB cache (this will pick up test-upserted entries)
            const treeFromCache = await (get() as any)._buildFileTreeFromCache(activeWorkspace.id);
            if (treeFromCache && treeFromCache.length > 0) {
              set({ fileTree: treeFromCache, currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/samples' });
              return;
            }

            // Fallback: attempt to load sample files via the helper (browser fetch or test mock)
            const fileTree = await buildSamplesFileTree();
            set({ fileTree, currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/samples' });
          } catch (e) {
            console.error('Failed to load verve-samples workspace files', e);
            set({ fileTree: [], currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/samples' });
          }
          return;
        }

        try {
          const fileTree = await (get() as any)._buildFileTreeFromCache(activeWorkspace.id);
          set({ fileTree, currentDirectoryName: activeWorkspace.name, currentDirectoryPath: '/' });
        } catch (e) {
          console.error('Failed to load workspace files from cache', e);
          set({ fileTree: [], currentDirectoryName: activeWorkspace.name, currentDirectoryPath: '/' });
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
          const fileTree = await buildSamplesFileTree();
          set({ fileTree, currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/samples' });
        } catch (e) {
          console.error('Failed to reload verve-samples workspace files', e);
        }
      },

      /** Clears the currently open local directory */
      clearLocalDirectory: () => {
        set({ fileTree: [], currentDirectoryName: null, currentDirectoryPath: null, expandedFolders: new Set() });
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

            // Dev invariant: prevent persisted derived `fileTree` from being rehydrated.
            // If `fileTree` exists in persisted payload, clear it and warn so we don't
            // accidentally rely on stale derived state. Consumers should call `getFileTree()`.
            try {
              if ((state as any).fileTree && (state as any).fileTree.length > 0) {
                // In tests we may rely on fileTree for samples; only log in non-test env
                if (process.env.NODE_ENV !== 'test') {
                  console.warn('[FileExplorerStore] Persisted `fileTree` detected on rehydrate — clearing derived state. Use `getFileTree()` instead of persisting `fileTree`.');
                }
                (state as any).fileTree = [];
              }
            } catch (e) {
              // swallow
            }
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

  const unsubWorkspace = useWorkspaceStore.subscribe(s => s.activeWorkspaceId, (newId) => {
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

// Dev-only subscription: detect accidental persistence or usage of derived `fileTree`.
if (process.env.NODE_ENV !== 'production') {
  try {
    useFileExplorerStore.subscribe((state) => {
      try {
        const ft = (state as any).fileTree;
        if (ft && Array.isArray(ft) && ft.length > 0) {
          // Warn in non-test environments to avoid noisy test logs
          if (process.env.NODE_ENV !== 'test') {
            console.warn('[FileExplorerStore] `fileTree` is non-empty in memory. Prefer `fileMap + rootIds` and compute `getFileTree()` on demand.');
          }
        }
      } catch (e) {
        // ignore
      }
    });
  } catch (e) {
    // ignore subscription failures
  }
}

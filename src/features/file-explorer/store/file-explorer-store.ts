import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FileNode } from "@/shared/types";
import { buildDemoFileTree } from "@/utils/demo-file-tree";
import { getAllFolderIds, buildFileTreeFromAdapter } from "./helpers/file-tree-builder";
import {
  openLocalDirectory as openLocalDir,
  restoreLocalDirectory as restoreLocalDir,
  refreshLocalDirectory,
  hasLocalDirectory,
  clearLocalDirectory,
} from "./helpers/directory-handler";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import {
  createFile as createFileOp,
  createFolder as createFolderOp,
  renameNode as renameNodeOp,
  deleteNode as deleteNodeOp,
} from "./helpers/file-operations";
import { getFileManager } from "@/core/store/file-manager-integration";

/**
 * File Explorer Store State
 * Manages the file tree, expanded folders, and selected file
 */
interface FileExplorerStore {
  expandedFolders: Set<string>;
  selectedFileId: string | null;
  fileTree: FileNode[];
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

      /**
       * Opens a local directory using the File System Access API
       * @param workspaceId - Optional workspace ID for persisting the directory handle
       */
      openLocalDirectory: async (workspaceId?: string) => {
        try {
          set({ isLoadingLocalFiles: true });

          const result = await openLocalDir(workspaceId);

          set({
            fileTree: result.fileTree,
            expandedFolders: new Set(),
            currentDirectoryName: result.name,
            currentDirectoryPath: result.path,
          });
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error opening directory:', error);
            alert('Failed to open directory: ' + (error as Error).message);
          }
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

          const result = await restoreLocalDir(workspaceId);

          if (!result) {
            return false;
          }

          set({
            fileTree: result.fileTree,
            expandedFolders: new Set(),
            currentDirectoryName: result.name,
            currentDirectoryPath: result.path,
          });

          return true;
        } catch (error) {
          console.error('Error restoring directory:', error);
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
          await createFileOp(parentPath, fileName);

          // Force sync the file immediately and wait for completion
          const workspace = useWorkspaceStore.getState().activeWorkspace();
          if (workspace) {
            const manager = getFileManager(workspace);
            await manager.forceSync(filePath);
          }

          await get().refreshFileTree();
        } catch (error) {
          console.error('Error creating file:', error);
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
          await createFolderOp(parentPath, folderName);

          // Force sync the folder immediately and wait for completion
          const workspace = useWorkspaceStore.getState().activeWorkspace();
          if (workspace) {
            const manager = getFileManager(workspace);
            await manager.forceSync(folderPath);
          }

          await get().refreshFileTree();
        } catch (error) {
          console.error('Error creating folder:', error);
          throw error;
        }
      },

      /** Renames a file or folder (currently demo mode only) */
      renameNode: async (nodePath: string, newName: string) => {
        try {
          await renameNodeOp(nodePath, newName);

          // Force sync and wait for completion
          const workspace = useWorkspaceStore.getState().activeWorkspace();
          if (workspace) {
            const manager = getFileManager(workspace);
            await manager.forceSync(nodePath);
          }

          await get().refreshFileTree();
        } catch (error) {
          console.error('Error renaming:', error);
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
          await deleteNodeOp(nodePath, isFolder);

          // Force sync and wait for completion
          const workspace = useWorkspaceStore.getState().activeWorkspace();
          if (workspace) {
            const manager = getFileManager(workspace);
            await manager.forceSync(nodePath);
          }

          await get().refreshFileTree();
        } catch (error) {
          console.error('Error deleting:', error);
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
        const allFolderIds = getAllFolderIds(state.fileTree);
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

      /** Refreshes the file tree from the current source */
      refreshFileTree: async () => {
        const state = get();

        // Get the active workspace to determine which file tree to load
        const activeWorkspace = useWorkspaceStore.getState().activeWorkspace();

        // If no workspace is active, show empty
        if (!activeWorkspace) {
          set({ fileTree: [], currentDirectoryName: null, currentDirectoryPath: null });
          return;
        }

        // For browser workspaces, use adapter to load files
        if (activeWorkspace.type === 'browser') {
          if (activeWorkspace.id === 'verve-samples') {
            // Special case: Load demo files for samples workspace using FileManager
            try {
              const fileManager = getFileManager(activeWorkspace);
              const fileTree = await buildFileTreeFromAdapter(
                fileManager,
                '',
                'demo-'
              );
              set({ fileTree, currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/demo' });
            } catch (e) {
              console.error('Failed to load verve-samples workspace files', e);
              set({ fileTree: [], currentDirectoryName: 'Verve Samples', currentDirectoryPath: '/demo' });
            }
          } else {
            // Other browser workspaces: Load from DemoAdapterV2
            try {
              const fileManager = getFileManager(activeWorkspace);
              const fileTree = await buildFileTreeFromAdapter(
                fileManager,
                '',
                ''
              );
              set({
                fileTree,
                currentDirectoryName: activeWorkspace.name,
                currentDirectoryPath: '/'
              });
            } catch (e) {
              console.error('Failed to load browser workspace files', e);
              set({ fileTree: [], currentDirectoryName: activeWorkspace.name, currentDirectoryPath: '/' });
            }
          }
          return;
        }

        // For local workspace, check if directory handle exists and refresh
        if (activeWorkspace.type === 'local') {
          if (hasLocalDirectory()) {
            const fileTree = await refreshLocalDirectory();
            if (fileTree) {
              set({ fileTree, currentDirectoryName: activeWorkspace.name, currentDirectoryPath: '/' });
              return;
            }
          }
          // If local workspace but no directory handle, show empty or prompt to restore
          set({ fileTree: [], currentDirectoryName: activeWorkspace.name, currentDirectoryPath: '/' });
          return;
        }

        // For Google Drive workspace: fetch and display all files from the drive folder
        if (activeWorkspace.type === 'drive' && activeWorkspace.driveFolder) {
          set({ isSyncingDrive: true });
          try {
            const fileManager = getFileManager(activeWorkspace);
            const fileTree = await buildFileTreeFromAdapter(
              fileManager,
              activeWorkspace.driveFolder,
              'gdrive-'
            );

            const rootName = activeWorkspace.name || 'Google Drive';
            set({
              fileTree,
              currentDirectoryName: rootName,
              currentDirectoryPath: activeWorkspace.driveFolder
            });
            return;
          } catch (e) {
            console.error('Failed to load Google Drive folder', e);
            set({ fileTree: [] });
            return;
          } finally {
            set({ isSyncingDrive: false });
          }
        }

        // No matching workspace type - show empty
        set({ fileTree: [], currentDirectoryName: null, currentDirectoryPath: null });
      },

      /** Clears the currently open local directory */
      clearLocalDirectory: () => {
        clearLocalDirectory();
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

  // Subscribe to file manager sync status for pending count
  setInterval(() => {
    try {
      const workspace = useWorkspaceStore.getState().activeWorkspace();
      if (workspace) {
        const manager = getFileManager(workspace);
        const syncStatus = manager.getSyncStatus();
        const pendingCount = syncStatus.pending + syncStatus.processing;
        useFileExplorerStore.getState().setPendingSyncCount(pendingCount);
      }
    } catch (e) {
      // ignore if manager not initialized yet
    }
  }, 1000);
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FileNode } from "@/shared/types";
import { buildDemoFileTree } from "@/utils/demo-file-tree";
import { getAllFolderIds } from "./helpers/file-tree-builder";
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

/**
 * File Explorer Store State
 * Manages the file tree, expanded folders, and selected file
 */
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
  setIsLoadingLocalFiles: (loading: boolean) => void;
  setCurrentDirectory: (name: string, path: string) => void;

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
      currentDirectoryName: null,
      currentDirectoryPath: null,

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

      setCurrentDirectory: (name, path) => set({ currentDirectoryName: name, currentDirectoryPath: path }),
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
          await createFileOp(parentPath, fileName);
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
          await createFolderOp(parentPath, folderName);
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

        // If no workspace is active or it's a browser workspace, load demo files
        if (!activeWorkspace || activeWorkspace.type === 'browser') {
          const fileTree = await buildDemoFileTree();
          set({ fileTree });
          return;
        }

        // For local workspace, check if directory handle exists and refresh
        if (activeWorkspace.type === 'local') {
          if (hasLocalDirectory()) {
            const fileTree = await refreshLocalDirectory();
            if (fileTree) {
              set({ fileTree });
              return;
            }
          }
          // If local workspace but no directory handle, show empty or prompt to restore
          set({ fileTree: [] });
          return;
        }

        // For Google Drive workspace: show the workspace name as the root folder label
        if (activeWorkspace.type === 'drive' && activeWorkspace.driveFolder) {
          try {
            const gdriveFolder = activeWorkspace.driveFolder;
            const verveFileId = window.localStorage.getItem('verve_gdrive_verve_file_id');
            const children: FileNode[] = [];

            if (verveFileId) {
              children.push({
                id: `gdrive-${verveFileId}`,
                name: 'verve.md',
                path: verveFileId,
                type: 'file'
              });
            }

            const rootName = activeWorkspace.name || 'Google Drive';

            const nodes: FileNode[] = [
              {
                id: `gdrive-${gdriveFolder}`,
                name: rootName,
                path: gdriveFolder,
                type: 'folder',
                children
              },
            ];

            set({ fileTree: nodes, currentDirectoryName: rootName, currentDirectoryPath: gdriveFolder });
            return;
          } catch (e) {
            console.error('Failed to load Google Drive folder', e);
            set({ fileTree: [] });
            return;
          }
        }

        // Fallback to demo files if no workspace type matches
        const fileTree = await buildDemoFileTree();
        set({ fileTree });
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

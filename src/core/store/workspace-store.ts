/**
 * Workspace Store - Manages multiple workspaces (browser, local, Google Drive)
 * Allows users to switch between different content sources
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MarkdownFile } from "@/shared/types";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { initializeFileOperations } from '@/core/cache/file-operations';
import { getSyncManager } from '@/core/sync/sync-manager';

/**
 * Workspace Interface
 * Represents a content source (browser storage, local folder, or Google Drive)
 */
export interface Workspace {
  id: string;
  name: string;
  type: 'browser' | 'local' | 'drive';
  path?: string;
  driveFolder?: string;
  createdAt: string;
  lastAccessed: string;
  isDefault?: boolean;
}

/**
 * Workspace Store State Interface
 */
interface WorkspaceStore {
  /** Array of all workspaces */
  workspaces: Workspace[];
  /** ID of the currently active workspace */
  activeWorkspaceId: string | null;
  /** Whether the workspace picker dialog is open */
  isWorkspacePickerOpen: boolean;
  /** Whether a workspace switch is in progress */
  isWorkspaceSwitching: boolean;
  
  /** Creates a new workspace */
  createWorkspace: (name: string, type: Workspace['type'], options?: { id?: string; path?: string; driveFolder?: string }) => void;
  /** Deletes a workspace by ID */
  deleteWorkspace: (id: string) => void;
  /** Switches to a different workspace */
  switchWorkspace: (id: string) => Promise<void>;
  /** Updates workspace properties */
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  /** Opens or closes the workspace picker dialog */
  setWorkspacePickerOpen: (open: boolean) => void;
  
  /** Gets the currently active workspace */
  activeWorkspace: () => Workspace | null;
  /** Gets all browser-based workspaces */
  getBrowserWorkspaces: () => Workspace[];
  /** Gets all local file system workspaces */
  getLocalWorkspaces: () => Workspace[];
  /** Gets all Google Drive workspaces */
  getDriveWorkspaces: () => Workspace[];
  /** Mapping of workspaceId -> opened tabs and active tab for that workspace */
  tabsByWorkspace: Record<string, { openTabs: MarkdownFile[]; activeTabId: string | null }>;
  /** Save current editor tabs into the store for a workspace */
  saveTabsForWorkspace: (workspaceId?: string) => void;
  /** Restore editor tabs from the store for a workspace (reloads content from file manager) */
  restoreTabsForWorkspace: (workspaceId?: string) => Promise<void>;
}

/**
 * Workspace Store Implementation
 * Persists workspace list and active workspace to localStorage
 */
export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      isWorkspacePickerOpen: false,
      isWorkspaceSwitching: false,
      tabsByWorkspace: {},

      /**
       * Creates a new workspace with the specified type and options
       * Automatically sets it as the active workspace
       * Clears all opened tabs since new workspace has no opened files
       */
      createWorkspace: (name, type, options = {}) => {
        const workspaceId = options.id ?? `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const workspace: Workspace = {
          id: workspaceId,
          name,
          type,
          path: options.path,
          driveFolder: options.driveFolder,
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        };

        // Clear all opened tabs as new workspace has no opened files
        useEditorStore.getState().closeAllTabs();

        set((state) => ({
          workspaces: [...state.workspaces, workspace],
          activeWorkspaceId: workspace.id,
        }));

        // Create a default file for new browser workspaces (but skip the verve-samples placeholder)
        if (type === 'browser' && workspaceId !== 'verve-samples') {
          (async () => {
            try {
              // Ensure file operations are initialized before saving
              try {
                await initializeFileOperations();
              } catch (initErr) {
                console.warn('Failed to initialize file operations before creating default file:', initErr);
              }

              const { saveFile } = await import('@/core/cache/file-operations');
              await saveFile('verve.md', '# Verve🚀', type, undefined, workspaceId);
            } catch (err) {
              console.warn('Failed to create default verve.md file in new workspace:', err);
            }
          })();
        }
      },

      /**
       * Deletes a workspace by ID
       * If deleting the active workspace, switches to the first available workspace
       */
      deleteWorkspace: (id) => {
        set((state) => {
          const newWorkspaces = state.workspaces.filter(w => w.id !== id);
          const newActiveId = state.activeWorkspaceId === id ? 
            (newWorkspaces[0]?.id || null) : state.activeWorkspaceId;
          
          return {
            workspaces: newWorkspaces,
            activeWorkspaceId: newActiveId,
          };
        });
      },

      /**
       * Switches to a different workspace by ID
       * Updates the lastAccessed timestamp for the workspace
       * Sets loading state and clears content during switch
       */
      switchWorkspace: async (id) => {
        // Set loading state
        set({ isWorkspaceSwitching: true });

        // Clear editor content immediately to prevent showing stale content
        useEditorStore.getState().closeAllTabs();

        // Save current editor tabs for the previous workspace
        try {
          const prevId = get().activeWorkspaceId;
          if (prevId) {
            get().saveTabsForWorkspace(prevId);
          }
        } catch (err) {
          console.warn('Failed to save tabs for previous workspace:', err);
        }

        // Update active workspace and timestamp first
        let targetWorkspace = null as any;
        set((state) => {
          const workspace = state.workspaces.find(w => w.id === id);
          if (!workspace) return state;

          targetWorkspace = { ...workspace, lastAccessed: new Date().toISOString() };

          const updatedWorkspaces = state.workspaces.map(w =>
            w.id === id ? { ...w, lastAccessed: new Date().toISOString() } : w
          );

          return {
            workspaces: updatedWorkspaces,
            activeWorkspaceId: id,
          };
        });

        // Pull fresh data from the remote source for this workspace (blocking)
        try {
          if (targetWorkspace) {
            await getSyncManager().pullWorkspace(targetWorkspace);
          }
        } catch (err) {
          console.warn('Failed to pull workspace contents during switch:', err);
        }

        // Restore tabs for the newly active workspace (reloads content from RxDB)
        try {
          await get().restoreTabsForWorkspace(id);
        } catch (err) {
          console.warn('Failed to restore tabs for workspace:', err);
        } finally {
          // Clear loading state
          set({ isWorkspaceSwitching: false });
        }
      },

      /**
       * Updates properties of a workspace
       */
      updateWorkspace: (id, updates) => {
        set((state) => ({
          workspaces: state.workspaces.map(w =>
            w.id === id ? { ...w, ...updates } : w
          ),
        }));
      },

      /**
       * Opens or closes the workspace picker dialog
       */
      setWorkspacePickerOpen: (open) => {
        set({ isWorkspacePickerOpen: open });
      },

      /**
       * Gets the currently active workspace
       */
      activeWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get();
        return workspaces.find(w => w.id === activeWorkspaceId) || null;
      },

      /**
       * Filters and returns all browser-based workspaces
       */
      getBrowserWorkspaces: () => {
        return get().workspaces.filter(w => w.type === 'browser');
      },

      /**
       * Filters and returns all local file system workspaces
       */
      getLocalWorkspaces: () => {
        return get().workspaces.filter(w => w.type === 'local');
      },

      /**
       * Filters and returns all Google Drive workspaces
       */
      getDriveWorkspaces: () => {
        return get().workspaces.filter(w => w.type === 'drive');
      },

      /**
       * Save current editor tabs for the provided workspaceId (or active workspace if omitted)
       */
      saveTabsForWorkspace: (workspaceId) => {
        const idToSave = workspaceId ?? get().activeWorkspaceId;
        if (!idToSave) return;

        try {
          const editorState = useEditorStore.getState();
          set((state) => ({
            tabsByWorkspace: {
              ...state.tabsByWorkspace,
              [idToSave]: {
                openTabs: editorState.openTabs || [],
                activeTabId: editorState.activeTabId || null,
              },
            },
          }));
        } catch (err) {
          console.warn('Failed to save tabs for workspace:', err);
        }
      },

      /**
       * Restore editor tabs for the provided workspaceId (or active workspace if omitted)
       * Reloads file contents from the file manager to ensure fresh data for the workspace
       */
      restoreTabsForWorkspace: async (workspaceId) => {
        const idToRestore = workspaceId ?? get().activeWorkspaceId;
        if (!idToRestore) return;

        try {
          const saved = get().tabsByWorkspace[idToRestore];
          if (saved && saved.openTabs && saved.openTabs.length > 0) {
            // First, set the tabs structure (without content to avoid stale data)
            useEditorStore.setState({
              openTabs: saved.openTabs,
              activeTabId: saved.activeTabId,
              isLoading: true
            });

            // Then reload file contents from the RxDB cache for the new workspace
            const workspace = get().workspaces.find(w => w.id === idToRestore);
            if (workspace) {
              const { loadFile } = await import('@/core/cache/file-operations');

              // Reload each tab's content from the RxDB cache
              const reloadedTabs = await Promise.all(
                saved.openTabs.map(async (tab) => {
                  try {
                    // Load fresh content from RxDB cache
                    const fileData = await loadFile(tab.path, workspace.type, workspace.id);
                    return {
                      ...tab,
                      content: fileData.content,
                      id: fileData.id,
                    };
                  } catch (err) {
                    console.warn(`Failed to reload file ${tab.path}:`, err);
                    // Keep the tab but with a note that it failed to load
                    return tab;
                  }
                })
              );

              // Update tabs with fresh content
              useEditorStore.setState({
                openTabs: reloadedTabs,
                activeTabId: saved.activeTabId,
                isLoading: false
              });
            } else {
              useEditorStore.setState({ isLoading: false });
            }
          } else {
            // No saved tabs for this workspace -> clear editor
            useEditorStore.getState().closeAllTabs();
          }
        } catch (err) {
          console.warn('Failed to restore tabs for workspace:', err);
          useEditorStore.setState({ isLoading: false });
        }
      },
    }),
    {
      name: 'verve-workspace-store',
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
        tabsByWorkspace: state.tabsByWorkspace,
      }),
      // After rehydration, restore tabs for the active workspace if any
      onRehydrateStorage: () => (err) => {
        if (err) return;
        try {
          // useWorkspaceStore is assigned by this module export; call after hydration
          const ws = (useWorkspaceStore as any).getState ? (useWorkspaceStore as any).getState() : null;
          if (ws && ws.activeWorkspaceId) {
            // Call restore via the store API
            ws.restoreTabsForWorkspace?.(ws.activeWorkspaceId);
          }
        } catch (e) {
          // ignore
        }
      },
    }
  )
);
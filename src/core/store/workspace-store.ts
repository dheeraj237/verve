/**
 * Workspace Store - Manages multiple workspaces (browser, local, Google Drive)
 * Allows users to switch between different content sources
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  
  /** Creates a new workspace */
  createWorkspace: (name: string, type: Workspace['type'], options?: { id?: string; path?: string; driveFolder?: string }) => void;
  /** Deletes a workspace by ID */
  deleteWorkspace: (id: string) => void;
  /** Switches to a different workspace */
  switchWorkspace: (id: string) => void;
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

      /**
       * Creates a new workspace with the specified type and options
       * Automatically sets it as the active workspace
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

        set((state) => ({
          workspaces: [...state.workspaces, workspace],
          activeWorkspaceId: workspace.id,
        }));
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
       */
      switchWorkspace: (id) => {
        set((state) => {
          const workspace = state.workspaces.find(w => w.id === id);
          if (!workspace) return state;

          const updatedWorkspaces = state.workspaces.map(w =>
            w.id === id ? { ...w, lastAccessed: new Date().toISOString() } : w
          );

          return {
            workspaces: updatedWorkspaces,
            activeWorkspaceId: id,
          };
        });
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
    }),
    {
      name: 'verve-workspace-store',
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    }
  )
);
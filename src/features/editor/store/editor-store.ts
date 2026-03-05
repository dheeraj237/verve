/**
 * Editor Store - Manages open files, tabs, and view mode
 * Uses Zustand for state management with RxDB cache integration
 * 
 * Features:
 * - Multi-tab editing
 * - File content synchronization via RxDB
 * - External update handling (file watchers)
 * - Multiple view modes (markdown/code/source)
 * - Local and cloud file support
 */
import { create } from "zustand";
import { FileNode, FileType } from "@/shared/types";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import { WorkspaceType } from '@/core/cache/types';
import { loadFile, saveFile } from "@/core/cache/file-manager";

// Debounce config for auto-save
const DEBOUNCE_CONFIG = {
  autoSave: 1000, // 1 second
  externalUpdate: 500, // 0.5 seconds
  cache: 2000, // 2 seconds
};

/**
 * Gets the active workspace type from workspace store
 */
function getActiveWorkspaceType() {
  const workspace = useWorkspaceStore.getState().activeWorkspace();
  return workspace?.type || WorkspaceType.Browser;
}

/**
 * UI state for a file tab (transient, not persisted)
 */
interface FileTabUiState {
  isSaving?: boolean;
  saveError?: string;
  lastSaved?: Date;
  isExternalUpdate?: boolean;
}

/** Editor Store State Interface */
interface EditorStore {
  openTabs: FileNode[];
  activeTabId: string | null;
  editorViewKey: number;
  isLoading: boolean;
  isCodeViewMode: boolean;
  isSourceMode: boolean;
  // Track UI state separately from FileNode to avoid persisting transient fields
  fileTabUiState: Record<string, FileTabUiState>;

  openFile: (file: FileNode) => void;
  closeTab: (fileId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (fileId: string) => void;
  bumpEditorViewKey: () => void;

  updateFileContent: (fileId: string, content: string) => void;
  handleExternalUpdate: (fileId: string, content: string) => void;
  applyEditorPatch: (fileId: string, content: string) => Promise<void>;

  openLocalFile: () => Promise<void>;
  loadFileFromManager: (path: string, isLocal?: boolean) => Promise<void>;
  openFileByPath: (relativePath: string, currentFilePath?: string, anchor?: string) => Promise<void>;

  setIsLoading: (loading: boolean) => void;
  setCodeViewMode: (isCode: boolean) => void;
  setSourceMode: (isSource: boolean) => void;
  setFileSaving: (fileId: string, isSaving: boolean) => void;
  setFileSaveError: (fileId: string, error?: string | null) => void;
}

 

 

export const useEditorStore = create<EditorStore>((set, get) => ({
  
  openTabs: [],
  activeTabId: null,
  isLoading: false,
  isCodeViewMode: false,
  isSourceMode: false,
  editorViewKey: 0,
  fileTabUiState: {},

  /**
   * Opens a file in a new tab or switches to it if already open
   * Prevents duplicate tabs for the same file
   */
  openFile: (file) => {
    console.log(`[EditorStore] openFile called with:`, {
      fileId: file.id,
      filePath: file.path,
      fileName: file.name,
      contentLength: file.content?.length || 0,
      contentPreview: file.content?.substring(0, 200),
      isHtmlContent: file.content?.includes('<!DOCTYPE') || file.content?.includes('<html'),
    });
    
    set((state) => {
      const existingTab = state.openTabs.find(tab => tab.id === file.id);
      if (existingTab) {
        console.log(`[EditorStore] File already open (switching tab)`);
        return { activeTabId: file.id };
      }
      console.log(`[EditorStore] Creating new tab for file`);
      return {
        openTabs: [...state.openTabs, file],
        activeTabId: file.id,
      };
    });
  },

  /**
   * Closes a tab by file ID
   * When closing active tab, switches to adjacent tab (next or previous)
   */
  closeTab: (fileId) => set((state) => {
    const newTabs = state.openTabs.filter(tab => tab.id !== fileId);
    let newActiveId = state.activeTabId;

    
    if (state.activeTabId === fileId) {
      const currentIndex = state.openTabs.findIndex(tab => tab.id === fileId);
      if (newTabs.length > 0) {
        
        const nextIndex = currentIndex < newTabs.length ? currentIndex : currentIndex - 1;
        newActiveId = newTabs[nextIndex]?.id || null;
      } else {
        newActiveId = null;
      }
    }

    // Clean up UI state for closed tab
    const newUiState = { ...state.fileTabUiState };
    delete newUiState[fileId];

    return {
      openTabs: newTabs,
      activeTabId: newActiveId,
      fileTabUiState: newUiState,
      // bump the editor view key so editor components remount and clear any stale instance
      editorViewKey: state.editorViewKey + 1,
    };
  }),

  /**
   * Closes all open tabs
   */
  closeAllTabs: () => set((state) => ({ openTabs: [], activeTabId: null, fileTabUiState: {}, editorViewKey: state.editorViewKey + 1 })),

  bumpEditorViewKey: () => set((state) => ({ editorViewKey: state.editorViewKey + 1 })),

  /**
   * Sets the currently active tab
   */
  setActiveTab: (fileId) => set({ activeTabId: fileId }),

  /**
   * Updates the content of an open file
   */
  updateFileContent: (fileId, content) => set((state) => ({
    openTabs: state.openTabs.map(tab =>
      tab.id === fileId ? { ...tab, content } : tab
    ),
  })),

  /**
   * Sets the saving state for a file (transient UI state, not persisted to FileNode)
   */
  setFileSaving: (fileId, isSaving) => set((state) => ({
    fileTabUiState: {
      ...state.fileTabUiState,
      [fileId]: {
        ...(state.fileTabUiState[fileId] || {}),
        isSaving,
        ...(isSaving ? { saveError: undefined } : {}),
      },
    },
  })),


  setFileSaveError: (fileId, error) => set((state) => ({
    fileTabUiState: {
      ...state.fileTabUiState,
      [fileId]: {
        ...(state.fileTabUiState[fileId] || {}),
        saveError: error ?? undefined,
      },
    },
  })),

  /**
   * Handles external file updates (from file system watcher)
   * Marks the update as external to differentiate from user edits
   */
  handleExternalUpdate: (fileId, content) => set((state) => {
    const tab = state.openTabs.find(t => t.id === fileId);
    if (!tab) return state;

    return {
      openTabs: state.openTabs.map(t =>
        t.id === fileId ? { ...t, content } : t
      ),
      fileTabUiState: {
        ...state.fileTabUiState,
        [fileId]: {
          ...(state.fileTabUiState[fileId] || {}),
          isExternalUpdate: true,
        },
      },
    };
  }),

  /**
   * Applies editor patch asynchronously to RxDB cache
   * Non-blocking - updates UI immediately, syncs to storage in background
   */
  applyEditorPatch: async (fileId, content) => {
    const tab = get().openTabs.find(t => t.id === fileId);
    if (!tab) return;

    try {
      // Optimistic update - UI updates immediately
      get().updateFileContent(fileId, content);

      // Background sync with auto-save debounce (fire-and-forget)
      get().setFileSaving(fileId, true);
      // Clear any previous save error when starting a new save
      get().setFileSaveError(fileId, undefined);

      const workspaceType = getActiveWorkspaceType();
      const workspace = useWorkspaceStore.getState().activeWorkspace?.();
      const workspaceId = workspace?.id;

      // Persist via file-manager only. Sync/enqueue behavior moved out of the editor store.
      saveFile(tab.path, content, workspaceType, undefined, workspaceId)
        .then((fileData) => {
          get().setFileSaving(fileId, false);
          // Update the FileNode.modifiedAt directly on the open tab so UI reads authoritative value
          const modifiedAt = (fileData as any)?.modifiedAt || new Date().toISOString();
          set((state) => ({
            openTabs: state.openTabs.map(t => t.id === fileId ? { ...t, modifiedAt } : t),
          }));
          get().setFileSaveError(fileId, undefined);
        })
        .catch((err) => {
          console.error('Background save failed:', err);
          get().setFileSaving(fileId, false);
          const msg = err instanceof Error ? err.message : String(err);
          get().setFileSaveError(fileId, msg);
        });
    } catch (error) {
      console.error('Failed to start background save:', error);
    }
  },

  /**
   * Loads a file through the RxDB cache
   * Creates a MarkdownFile object and opens it in a new tab
   */
  loadFileFromManager: async (path, isLocal = false) => {
    try {
      set({ isLoading: true });

      const workspaceType = getActiveWorkspaceType();
      const workspace = useWorkspaceStore.getState().activeWorkspace?.();
      const workspaceId = workspace?.id;

      const effectiveType = isLocal ? WorkspaceType.Local : workspaceType;
      const fileData = await loadFile(path, effectiveType, workspaceId);

      const fileNode: FileNode = {
        id: fileData.id,
        path: fileData.path,
        name: fileData.name,
        content: fileData.content,
        workspaceType: effectiveType,
        workspaceId: workspaceId || '',
        type: FileType.File,
        dirty: false,
        isSynced: true,
        syncStatus: 'idle',
        version: 0,
        isLocal,
      };

      get().openFile(fileNode);
    } catch (error) {
      console.error("Failed to load file:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Opens a local file using the File System Access API
   * Prompts user to select a markdown or text file
   */
  openLocalFile: async () => {
    // Local directory opening via SyncManager was removed from the editor store.
    // Use workspace-manager APIs (storeDirectoryHandle / requestPermissionForWorkspace)
    // from the workspace flow instead. This is a no-op placeholder so callers
    // don't crash but are reminded to use the workspace manager.
    console.warn('openLocalFile removed from editor store; use workspace-manager APIs');
    return Promise.resolve();
  },

  /**
   * Opens a file by relative path (used for markdown link navigation)
   * Resolves relative paths, finds the file in the tree, and opens it
   * Optionally scrolls to a specific heading anchor
   * 
   * @param relativePath - Relative path to the file (e.g., "./file.md" or "../folder/file.md")
   * @param currentFilePath - Path of the current file (for resolving relative paths)
   * @param anchor - Optional heading anchor to scroll to (e.g., "heading-slug")
   */
  openFileByPath: async (relativePath: string, currentFilePath?: string, anchor?: string) => {
    try {
      set({ isLoading: true });

      // Simple relative path resolver (handles ./ and ../). If relativePath is
      // absolute (starts with '/'), use as-is.
      let targetPath = relativePath;
      if (currentFilePath && !relativePath.startsWith('/')) {
        const baseDir = currentFilePath.replace(/\/[^/]*$/, '');
        const baseSegments = baseDir.split('/').filter(Boolean);
        const relSegments = relativePath.split('/').filter(Boolean);
        const stack = [...baseSegments];
        for (const seg of relSegments) {
          if (seg === '.' || seg === '') continue;
          if (seg === '..') {
            stack.pop();
          } else {
            stack.push(seg);
          }
        }
        targetPath = '/' + stack.join('/');
      }

      const workspaceType = getActiveWorkspaceType();
      const workspace = useWorkspaceStore.getState().activeWorkspace?.();
      const workspaceId = workspace?.id;

      // Load via file-manager only. UI-level file-tree lookups and local-file
      // pulls are out of scope for the editor store (moved to file-explorer / sync).
      const fileData = await loadFile(targetPath, workspaceType, workspaceId);

      get().openFile({
        id: fileData.id,
        path: fileData.path,
        name: fileData.name,
        content: fileData.content,
        workspaceType: workspaceType,
        workspaceId: workspaceId || '',
        type: FileType.File,
        dirty: false,
        isSynced: true,
        syncStatus: 'idle',
        version: 0,
      });

      if (anchor) {
        // Anchor scrolling is a UI concern — editor store no longer performs scrolling.
        console.warn('Anchor handling removed from editor store for openFileByPath');
      }
    } catch (error) {
      console.error('Failed to open file by path:', error);
      alert(error instanceof Error ? error.message : 'Failed to open file');
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /** Sets the loading state */
  setIsLoading: (loading) => set({ isLoading: loading }),

  /** Toggles code view mode (shows syntax highlighting for languages) */
  setCodeViewMode: (isCode) => set({ isCodeViewMode: isCode }),

  /** Toggles source mode (shows raw markdown) */
  setSourceMode: (isSource) => set({ isSourceMode: isSource }),
}));

/**
 * Helper hook to get the currently active file
 * 
 * @returns The active FileNode or null if no file is open
 */
export const useCurrentFile = () => {
  const { openTabs, activeTabId } = useEditorStore();
  return openTabs.find(tab => tab.id === activeTabId) || null;
};

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
import { MarkdownFile } from "@/shared/types";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import {
  initializeFileOperations,
  loadFile,
  saveFile,
  listFiles,
} from "@/core/cache/file-operations";
import { isFeatureEnabled } from '@/core/config/features';
import { getSyncManager } from '@/core/sync/sync-manager';

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
  return workspace?.type || 'browser';
}

/** Editor Store State Interface */
interface EditorStore {
  openTabs: MarkdownFile[];
  activeTabId: string | null;
  editorViewKey: number;
  isLoading: boolean;
  isCodeViewMode: boolean;
  isSourceMode: boolean;

  openFile: (file: MarkdownFile) => void;
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
  setFileLastSaved: (fileId: string, lastSaved: Date) => void;
  setFileSaveError: (fileId: string, error?: string | null) => void;
}

 

 

export const useEditorStore = create<EditorStore>((set, get) => ({
  
  openTabs: [],
  activeTabId: null,
  isLoading: false,
  isCodeViewMode: false,
  isSourceMode: false,
  editorViewKey: 0,

  /**
   * Opens a file in a new tab or switches to it if already open
   * Prevents duplicate tabs for the same file
   */
  openFile: (file) => set((state) => {
    
    const existingTab = state.openTabs.find(tab => tab.id === file.id);
    if (existingTab) {
      return { activeTabId: file.id };
    }
    return {
      openTabs: [...state.openTabs, file],
      activeTabId: file.id,
    };
  }),

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

    return {
      openTabs: newTabs,
      activeTabId: newActiveId,
      // bump the editor view key so editor components remount and clear any stale instance
      editorViewKey: state.editorViewKey + 1,
    };
  }),

  /**
   * Closes all open tabs
   */
  closeAllTabs: () => set((state) => ({ openTabs: [], activeTabId: null, editorViewKey: state.editorViewKey + 1 })),

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
   * Sets the saving state for a file
   */
  setFileSaving: (fileId, isSaving) => set((state) => ({
    openTabs: state.openTabs.map(tab =>
      tab.id === fileId ? { ...tab, isSaving, ...(isSaving ? { saveError: undefined } : {}) } : tab
    ),
  })),

  /**
   * Sets the last saved timestamp for a file
   */
  setFileLastSaved: (fileId, lastSaved) => set((state) => ({
    openTabs: state.openTabs.map(tab =>
      tab.id === fileId ? { ...tab, lastSaved } : tab
    ),
  })),

  setFileSaveError: (fileId, error) => set((state) => ({
    openTabs: state.openTabs.map(tab =>
      tab.id === fileId ? { ...tab, saveError: error ?? undefined } : tab
    ),
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
        t.id === fileId ? { ...t, content, isExternalUpdate: true } : t
      ),
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

      saveFile(tab.path, content, workspaceType, undefined, workspaceId)
        .then(async (fileData) => {
          get().setFileSaving(fileId, false);
          get().setFileLastSaved(fileId, new Date());
          get().setFileSaveError(fileId, undefined);

          try {
            // If this save originated from the active workspace, trigger authoritative push
            if (
              isFeatureEnabled('authoritativePush' as any) &&
              workspaceType !== 'browser' &&
              workspaceId === useWorkspaceStore.getState().activeWorkspace?.()?.id
            ) {
              // fileData.id is the cached file id
              await getSyncManager().enqueueAndProcess(fileData.id, tab.path, workspaceType, workspaceId);
            }
          } catch (e) {
            console.warn('Failed to enqueue/process sync for saved file:', e);
          }
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
      const fileData = await loadFile(path, workspaceType, workspaceId);

      const markdownFile: MarkdownFile = {
        id: fileData.id,
        path: fileData.path,
        name: fileData.name,
        content: fileData.content,
        category: isLocal ? 'local' : 'browser',
        isLocal,
      };

      get().openFile(markdownFile);
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
    try {
      
      if (!('showOpenFilePicker' in window)) {
        alert('File System Access API is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
        return;
      }

      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Markdown Files',
            accept: {
              'text/markdown': ['.md', '.markdown'],
              'text/plain': ['.txt'],
            },
          },
        ],
        multiple: false,
      });

      const file = await fileHandle.getFile();
      const content = await file.text();

      const markdownFile: MarkdownFile = {
        id: `local-${file.name}-${Date.now()}`,
        path: file.name,
        name: file.name,
        content,
        category: 'local',
        fileHandle,
        isLocal: true,
      };

      get().openFile(markdownFile);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error opening local file:', error);
        alert('Failed to open file: ' + (error as Error).message);
      }
    }
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
    const { resolveRelativePath, findFileInTree } = await import("@/shared/utils/file-path-resolver");
    const { useFileExplorerStore } = await import("@/features/file-explorer/store/file-explorer-store");

    try {
      set({ isLoading: true });

      // Resolve the relative path
      let targetPath = relativePath;
      if (currentFilePath) {
        const resolved = resolveRelativePath(currentFilePath, relativePath);
        if (!resolved) {
          throw new Error(`Invalid link path: ${relativePath}`);
        }
        targetPath = resolved;
      }

      // Find the file in the tree
      const fileTree = useFileExplorerStore.getState().fileTree;
      const fileNode = findFileInTree(fileTree, targetPath);

      if (!fileNode) {
        throw new Error(`File not found: ${targetPath}`);
      }

      // Handle local files with File System Access API
      if (fileNode.id.startsWith('local-file-')) {
        const dirHandle = (window as any).__localDirHandle;
        if (!dirHandle) {
          throw new Error('No directory handle available');
        }

        const pathParts = fileNode.path.split('/');
        let currentHandle = dirHandle;

        // Navigate to the file
        for (let i = 0; i < pathParts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
        }

        const fileHandle = await currentHandle.getFileHandle(pathParts[pathParts.length - 1]);
        const file = await fileHandle.getFile();
        const content = await file.text();

        get().openFile({
          id: fileNode.id,
          path: fileNode.path,
          name: fileNode.name,
          content,
          category: 'local',
          fileHandle,
          isLocal: true,
        });
      } else {
        // Load from RxDB cache
        const workspaceType = getActiveWorkspaceType();
        const workspace = useWorkspaceStore.getState().activeWorkspace?.();
        const workspaceId = workspace?.id;
        const fileData = await loadFile(fileNode.path, workspaceType, workspaceId);

        get().openFile({
          id: fileData.id,
          path: fileData.path,
          name: fileData.name,
          content: fileData.content,
          category: 'browser',
        });
      }

      if (anchor) {
        setTimeout(async () => {
          const { scrollToHeading } = await import('@/shared/utils/scroll-to-heading');
          const success = scrollToHeading(anchor);
          if (!success) {
            console.warn(`Anchor not found: ${anchor}`);
          }
        }, 500);
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
 * @returns The active MarkdownFile or null if no file is open
 */
export const useCurrentFile = () => {
  const { openTabs, activeTabId } = useEditorStore();
  return openTabs.find(tab => tab.id === activeTabId) || null;
};

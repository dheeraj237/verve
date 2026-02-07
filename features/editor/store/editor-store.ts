/**
 * Editor Store - Manages open files, tabs, and view mode
 * Uses Zustand for state management with file manager integration
 */
import { create } from "zustand";
import { MarkdownFile } from "@/shared/types";
import { FileManager } from "@/core/file-manager";
import { ServerFileSystemAdapter } from "@/core/file-manager/adapters/server-adapter";
import { LocalFileSystemAdapter } from "@/core/file-manager/adapters/local-adapter";

// Singleton file manager instance - shared across all store instances
const serverAdapter = new ServerFileSystemAdapter();
const localAdapter = new LocalFileSystemAdapter();
let fileManager: FileManager | null = null;

/**
 * Get or create file manager instance (lazy initialization)
 * Sets up external update listener on first creation
 */
function getFileManager(isLocal: boolean = false): FileManager {
  if (!fileManager) {
    fileManager = new FileManager(isLocal ? localAdapter : serverAdapter);

    // Listen for external file changes (e.g., from disk, git pull, etc.)
    fileManager.onUpdate((fileId, content) => {
      useEditorStore.getState().handleExternalUpdate(fileId, content);
    });
  }
  return fileManager;
}

interface EditorStore {
  openTabs: MarkdownFile[];
  activeTabId: string | null;
  isLoading: boolean;
  isCodeViewMode: boolean;
  openFile: (file: MarkdownFile) => void;
  closeTab: (fileId: string) => void;
  setActiveTab: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  handleExternalUpdate: (fileId: string, content: string) => void;
  applyEditorPatch: (fileId: string, content: string) => Promise<void>;
  setIsLoading: (loading: boolean) => void;
  setCodeViewMode: (isCode: boolean) => void;
  openLocalFile: () => Promise<void>;
  loadFileFromManager: (path: string, isLocal?: boolean) => Promise<void>;
  openFileByPath: (relativePath: string, currentFilePath?: string, anchor?: string) => Promise<void>;
  setFileSaving: (fileId: string, isSaving: boolean) => void;
  setFileLastSaved: (fileId: string, lastSaved: Date) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  openTabs: [],
  activeTabId: null,
  isLoading: false,
  isCodeViewMode: false,

  openFile: (file) => set((state) => {
    // Check if file is already open
    const existingTab = state.openTabs.find(tab => tab.id === file.id);
    if (existingTab) {
      return { activeTabId: file.id };
    }
    return {
      openTabs: [...state.openTabs, file],
      activeTabId: file.id,
    };
  }),

  closeTab: (fileId) => set((state) => {
    const newTabs = state.openTabs.filter(tab => tab.id !== fileId);
    let newActiveId = state.activeTabId;

    // When closing active tab, switch to adjacent tab (next or previous)
    if (state.activeTabId === fileId) {
      const currentIndex = state.openTabs.findIndex(tab => tab.id === fileId);
      if (newTabs.length > 0) {
        // Prefer next tab, fall back to previous if closing last tab
        const nextIndex = currentIndex < newTabs.length ? currentIndex : currentIndex - 1;
        newActiveId = newTabs[nextIndex]?.id || null;
      } else {
        newActiveId = null;
      }
    }

    return {
      openTabs: newTabs,
      activeTabId: newActiveId,
    };
  }),

  setActiveTab: (fileId) => set({ activeTabId: fileId }),

  updateFileContent: (fileId, content) => set((state) => ({
    openTabs: state.openTabs.map(tab =>
      tab.id === fileId ? { ...tab, content } : tab
    ),
  })),

  setFileSaving: (fileId, isSaving) => set((state) => ({
    openTabs: state.openTabs.map(tab =>
      tab.id === fileId ? { ...tab, isSaving } : tab
    ),
  })),

  setFileLastSaved: (fileId, lastSaved) => set((state) => ({
    openTabs: state.openTabs.map(tab =>
      tab.id === fileId ? { ...tab, lastSaved } : tab
    ),
  })),

  /**
   * Handle external file updates (from file system watcher)
   * This is called when file manager detects external changes
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
   * Apply editor patch asynchronously to file manager
   * This is called when editor content changes
   */
  applyEditorPatch: async (fileId, content) => {
    const tab = get().openTabs.find(t => t.id === fileId);
    if (!tab) return;

    const manager = getFileManager(tab.isLocal);

    // Apply patch to file manager (async, non-blocking)
    await manager.applyPatch({
      fileId,
      content,
      timestamp: Date.now(),
    });

    // Update local store immediately for UI responsiveness
    get().updateFileContent(fileId, content);
  },

  /**
   * Load file through file manager
   */
  loadFileFromManager: async (path, isLocal = false) => {
    try {
      set({ isLoading: true });

      const manager = getFileManager(isLocal);
      const fileData = await manager.loadFile(path);

      const markdownFile: MarkdownFile = {
        id: fileData.id,
        path: fileData.path,
        name: fileData.name,
        content: fileData.content,
        category: fileData.category,
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

  openLocalFile: async () => {
    try {
      // Check if File System Access API is supported
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

  openFileByPath: async (relativePath: string, currentFilePath?: string, anchor?: string) => {
    const { resolveRelativePath, findFileInTree } = await import("@/shared/utils/file-path-resolver");
    const { useFileExplorerStore } = await import("@/features/file-explorer/store/file-explorer-store");

    try {
      set({ isLoading: true });

      // Resolve the path relative to current file
      let targetPath = relativePath;
      if (currentFilePath) {
        const resolved = resolveRelativePath(currentFilePath, relativePath);
        if (!resolved) {
          throw new Error(`Invalid link path: ${relativePath}`);
        }
        targetPath = resolved;
      }

      // Get file tree from explorer store
      const fileTree = useFileExplorerStore.getState().fileTree;

      // Search for the file in the tree
      const fileNode = findFileInTree(fileTree, targetPath);

      if (!fileNode) {
        throw new Error(`File not found: ${targetPath}`);
      }

      // Check if this is a local file
      if (fileNode.id.startsWith('local-file-')) {
        // Read file from local file system
        const dirHandle = (window as any).__localDirHandle;
        if (!dirHandle) {
          throw new Error('No directory handle available');
        }

        const pathParts = fileNode.path.split('/');
        let currentHandle = dirHandle;

        // Navigate to the file through directory structure
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
        // Load from server
        const response = await fetch(`/api/files/${fileNode.path}`);
        const result = await response.json();

        if (result.success) {
          get().openFile({
            id: fileNode.id,
            path: fileNode.path,
            name: fileNode.name,
            content: result.data.content,
            category: fileNode.path.split("/")[0],
          });
        } else {
          throw new Error(result.error || 'Failed to load file');
        }
      }

      // Scroll to anchor after file is loaded (with delay for rendering)
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

  setIsLoading: (loading) => set({ isLoading: loading }),

  setCodeViewMode: (isCode) => set({ isCodeViewMode: isCode }),
}));

// Helper to get current file
export const useCurrentFile = () => {
  const { openTabs, activeTabId } = useEditorStore();
  return openTabs.find(tab => tab.id === activeTabId) || null;
};

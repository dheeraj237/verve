import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FileNode } from "@/shared/types";

interface FileExplorerStore {
  expandedFolders: Set<string>;
  selectedFileId: string | null;
  fileTree: FileNode[];
  toggleFolder: (folderId: string) => void;
  setSelectedFile: (fileId: string | null) => void;
  setFileTree: (tree: FileNode[]) => void;
}

export const useFileExplorerStore = create<FileExplorerStore>()(
  persist(
    (set) => ({
      expandedFolders: new Set<string>(),
      selectedFileId: null,
      fileTree: [],
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
    }),
    {
      name: "file-explorer-storage",
      partialize: (state) => ({
        expandedFolders: Array.from(state.expandedFolders),
        selectedFileId: state.selectedFileId,
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

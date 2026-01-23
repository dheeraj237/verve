import { create } from "zustand";
import { MarkdownFile, ViewMode } from "@/shared/types";

interface EditorStore {
  currentFile: MarkdownFile | null;
  viewMode: ViewMode;
  isLoading: boolean;
  setCurrentFile: (file: MarkdownFile | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  currentFile: null,
  viewMode: "preview",
  isLoading: false,
  setCurrentFile: (file) => set({ currentFile: file }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));

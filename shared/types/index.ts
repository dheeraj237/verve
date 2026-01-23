export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

export interface MarkdownFile {
  id: string;
  path: string;
  name: string;
  content: string;
  category: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ViewMode = "preview" | "edit" | "split";

export interface EditorState {
  currentFile: MarkdownFile | null;
  viewMode: ViewMode;
  isLoading: boolean;
}

export interface Feature {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  experimental?: boolean;
}

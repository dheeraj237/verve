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
  fileHandle?: FileSystemFileHandle; // For local files opened via File System Access API
  isLocal?: boolean; // Flag to indicate if file is from local system
}

export type ViewMode = "preview" | "editor" | "code" | "live";

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
  description?: string;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: FileNodeType;
  children?: FileNode[];
}

export interface MarkdownFile {
  id: string;
  path: string;
  name: string;
  content: string;

  createdAt?: string;
  updatedAt?: string;
  fileHandle?: FileSystemFileHandle; // For local files opened via File System Access API
  isLocal?: boolean; // Flag to indicate if file is from local system
  isExternalUpdate?: boolean; // Flag to indicate content was updated externally (not from editor)
  lastSaved?: Date; // Timestamp of last successful save
  isSaving?: boolean; // Flag to indicate if file is currently being saved
  category: FileCategory;
}

export enum ViewMode {
  Code = 'code',
  Live = 'live',
  Preview = 'preview',
}

export enum FileNodeType {
  File = 'file',
  Folder = 'folder',
}

export enum FileCategory {
  Browser = 'browser',
  Local = 'local',
  GDrive = 'gdrive',
}

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

export interface OpenedFile {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  isDirty: boolean; // Has unsaved changes
  workspaceId: string;
}

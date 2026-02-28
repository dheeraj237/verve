export type FileNode = {
  id: string;               // unique id (uuid or path-based)
  type: 'file' | 'directory';
  name: string;             // base name
  path: string;             // full path within workspace
  parentId?: string | null; // parent id (null for workspace root)
  children?: string[];      // array of child ids (only for directory)
  size?: number;            // bytes (files)
  modifiedAt?: string;      // ISO timestamp
  createdAt?: string;       // ISO timestamp
  dirty?: boolean;          // user-local changes not pushed
  isSynced?: boolean;       // whether last change is synced
  version?: number;         // incrementing revision/version
  mimeType?: string;
  meta?: Record<string, any>;
};

export enum FileNodeType {
  File = 'file',
  Directory = 'directory'
}

export default FileNode;

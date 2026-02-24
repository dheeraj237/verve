/**
 * Type definitions for File Manager V2
 */

export enum WorkspaceType {
  LOCAL = 'local',
  DEMO = 'demo',
  GOOGLE_DRIVE = 'google-drive',
}

export interface FileMetadata {
  id: string;
  path: string;
  name: string;
  category: string;
  size?: number;
  lastModified?: Date;
  mimeType?: string;
}

export interface FileData extends FileMetadata {
  content: string;
  version?: string;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'rename' | 'create-folder';
  path: string;
  newPath?: string;
  content?: string;
  version?: string;
  timestamp: number;
  debounceMs?: number;
  retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface AdapterCapabilities {
  supportsWatch: boolean;
  supportsBatch: boolean;
  supportsVersioning: boolean;
  supportsRename: boolean;
  supportsDirectories: boolean;
  maxFileSize: number;
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
}

/**
 * Base interface for all workspace adapters
 */
export interface WorkspaceAdapter {
  type: WorkspaceType;
  capabilities: AdapterCapabilities;

  readFile(path: string): Promise<FileData>;
  writeFile(path: string, content: string, version?: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(directory: string): Promise<FileMetadata[]>;

  renameFile?(oldPath: string, newPath: string): Promise<void>;
  createFolder?(path: string): Promise<void>;
  getFileVersion?(path: string): Promise<string | undefined>;
  getMetadata?(path: string): Promise<FileMetadata>;
}

export interface WorkspaceConfig {
  type: WorkspaceType;
  metadata?: {
    name: string;
    rootPath?: string;
    driveId?: string;
  };
}

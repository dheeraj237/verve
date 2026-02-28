export enum WorkspaceType {
  Browser = 'browser',
  Local = 'local',
  Drive = 'drive',
  GDrive = 'gdrive',
  S3 = 's3',
}

export enum FileType {
  File = 'file',
  Dir = 'directory',
}

export enum SyncOp {
  Put = 'put',
  Delete = 'delete',
}

export type CachedFile = {
  id: string;
  name: string;
  path: string;
  type: FileType;
  workspaceType: WorkspaceType; // Determines which adapters to use
  workspaceId?: string | null; // Optional workspace instance id to separate multiple workspaces of same type
  // `content` holds the file text for single-source-of-truth storage in RxDB
  content?: string;
  meta?: Record<string, any>;
  // Some modules use `metadata` instead of `meta` — accept both
  metadata?: Record<string, any>;
  size?: number;
  modifiedAt?: string;
  createdAt?: string;
  // Numeric lastModified timestamp used across adapters and file-operations
  lastModified?: number;
  dirty?: boolean; // Only relevant for 'local' and 'gdrive', not 'browser'
  isSynced?: boolean;
  version?: number;
  mimeType?: string;
  // RxDB may return readonly arrays; accept either mutable or readonly
  children?: string[] | ReadonlyArray<string>;
  parentId?: string | null;
};

export type SyncQueueEntry = {
  id: string;
  op: SyncOp;
  target: 'file';
  targetId: string;
  payload?: any;
  attempts?: number;
};

export enum WorkspaceType {
  Browser = 'browser',
  Local = 'local',
  Drive = 'drive',
  GDrive = 'gdrive',
  S3 = 's3',
}

export enum FileType {
  File = 'file',
  Dir = 'dir',
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
  workspaceId?: string; // Optional workspace instance id to separate multiple workspaces of same type
  // `content` holds the file text for single-source-of-truth storage in RxDB
  content?: string;
  metadata?: Record<string, any>;
  lastModified?: number;
  dirty?: boolean; // Only relevant for 'local' and 'gdrive', not 'browser'
};

export type SyncQueueEntry = {
  id: string;
  op: SyncOp;
  target: 'file';
  targetId: string;
  payload?: any;
  attempts?: number;
};

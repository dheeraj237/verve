export type WorkspaceType = 'browser' | 'local' | 'gdrive' | 's3';

export type CachedFile = {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'dir';
  workspaceType: WorkspaceType; // Determines which adapters to use
  crdtId?: string;
  metadata?: Record<string, any>;
  lastModified?: number;
  dirty?: boolean; // Only relevant for 'local' and 'gdrive', not 'browser'
};

export type CrdtDoc = {
  id: string; // crdtId
  fileId: string;
  // yjsState stored as base64 or binary attachment depending on platform
  yjsState?: string | Uint8Array;
  lastUpdated?: number;
};

export type SyncQueueEntry = {
  id: string;
  op: 'put' | 'delete';
  target: 'file' | 'crdt';
  targetId: string;
  payload?: any;
  attempts?: number;
};

export type CachedFile = {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'dir';
  crdtId?: string;
  metadata?: Record<string, any>;
  lastModified?: number;
  dirty?: boolean;
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

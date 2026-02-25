import { RxJsonSchema } from 'rxdb';
import type { CachedFile, CrdtDoc } from './types';

/**
 * RxDB JSON schema for cached_files collection
 * Stores lightweight file/directory metadata with links to CRDT docs
 */
export const cachedFileSchema: RxJsonSchema<CachedFile> = {
  title: 'cached_files schema',
  version: 0,
  type: 'object',
  primaryKey: 'id',
  properties: {
    id: {
      type: 'string',
      description: 'Unique file/directory identifier (UUID or path-based)'
    },
    name: {
      type: 'string',
      description: 'File or directory name'
    },
    path: {
      type: 'string',
      description: 'Full path in workspace'
    },
    type: {
      type: 'string',
      enum: ['file', 'dir'],
      description: 'Whether this is a file or directory'
    },
    workspaceType: {
      type: 'string',
      enum: ['browser', 'local', 'gdrive', 's3'],
      description: 'Workspace storage type (determines sync adapters)'
    },
    crdtId: {
      type: ['string', 'null'],
      description: 'Optional link to CRDT doc ID for text files'
    },
    metadata: {
      type: ['object', 'null'],
      description: 'Extended metadata (size, mime type, driveId, remoteETag, etc.)'
    },
    lastModified: {
      type: ['number', 'null'],
      description: 'Last modification time in milliseconds'
    },
    dirty: {
      type: 'boolean',
      default: false,
      description: 'Flag indicating local unsynced changes (not used for browser workspace)'
    }
  },
  required: ['id', 'name', 'path', 'type', 'workspaceType'],
  indexes: ['path', 'dirty', 'workspaceType']
};

/**
 * RxDB JSON schema for crdt_docs collection
 * Stores Yjs encoded state for collaborative editing with CRDT merging
 */
export const crdtDocSchema: RxJsonSchema<CrdtDoc> = {
  title: 'crdt_docs schema',
  version: 0,
  type: 'object',
  primaryKey: 'id',
  properties: {
    id: {
      type: 'string',
      description: 'CRDT document ID (same as crdtId in cached_files)'
    },
    fileId: {
      type: 'string',
      description: 'Foreign key to cached_files.id'
    },
    yjsState: {
      type: ['string', 'null'],
      description: 'Base64-encoded Yjs state vector or complete state'
    },
    lastUpdated: {
      type: ['number', 'null'],
      description: 'Last update timestamp in milliseconds'
    }
  },
  required: ['id', 'fileId'],
  indexes: ['fileId']
};

/**
 * RxDB JSON schema for sync_queue collection (optional, for batch operations)
 * Tracks pending sync operations to adapters
 */
export const syncQueueSchema: RxJsonSchema<{
  id: string;
  op: 'put' | 'delete';
  target: 'file' | 'crdt';
  targetId: string;
  payload?: any;
  attempts?: number;
  createdAt?: number;
}> = {
  title: 'sync_queue schema',
  version: 0,
  type: 'object',
  primaryKey: 'id',
  properties: {
    id: {
      type: 'string',
      description: 'Unique queue entry ID'
    },
    op: {
      type: 'string',
      enum: ['put', 'delete'],
      description: 'Operation type: put (update/create) or delete'
    },
    target: {
      type: 'string',
      enum: ['file', 'crdt'],
      description: 'Target collection'
    },
    targetId: {
      type: 'string',
      description: 'Primary key of the target document'
    },
    payload: {
      type: ['object', 'null'],
      description: 'Operation payload if needed'
    },
    attempts: {
      type: ['number', 'null'],
      default: 0,
      description: 'Number of sync attempts'
    },
    createdAt: {
      type: ['number', 'null'],
      description: 'Queue entry creation time'
    }
  },
  required: ['id', 'op', 'target', 'targetId'],
  indexes: ['createdAt']
};

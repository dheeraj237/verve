import { RxJsonSchema } from 'rxdb';
import type { CachedFile } from './types';

/**
 * RxDB JSON schema for cached_files collection
 * Stores lightweight file/directory metadata and file content (SSoT)
 */
export const cachedFileSchema: RxJsonSchema<CachedFile> = {
  title: 'cached_files schema',
  version: 3,
  type: 'object',
  primaryKey: 'id',
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 255 },
    type: { type: 'string', enum: ['file', 'directory'] },
    name: { type: 'string', maxLength: 255 },
    path: { type: 'string', maxLength: 1024 },
    parentId: { type: ['string', 'null'] },
    children: { type: ['array', 'null'], items: { type: 'string' } },
    size: { type: ['number', 'null'] },
    modifiedAt: { type: ['string', 'null'] },
    createdAt: { type: ['string', 'null'] },
    dirty: { type: 'boolean', default: false },
    synced: { type: 'boolean', default: true },
    version: { type: ['number', 'null'] },
    mimeType: { type: ['string', 'null'] },
    workspaceType: { type: 'string', maxLength: 50, enum: ['browser', 'local', 'gdrive', 's3'] },
    workspaceId: { type: ['string', 'null'], maxLength: 255 },
    content: { type: ['string', 'null'] },
    meta: { type: ['object', 'null'] }
  },
  required: ['id', 'name', 'path', 'type', 'workspaceType', 'dirty'],
  indexes: [['path'], ['workspaceType'], ['workspaceId']]
};

/**
 * RxDB JSON schema for crdt_docs collection
 * Stores Yjs encoded state for collaborative editing with CRDT merging
 */
// CRDT docs removed from schema. Content is stored directly on `cached_files`.

/**
 * RxDB JSON schema for sync_queue collection (optional, for batch operations)
 * Tracks pending sync operations to adapters
 */
export const syncQueueSchema: RxJsonSchema<{
  id: string;
  op: 'put' | 'delete';
  target: 'file';
  targetId: string;
  payload?: any;
  attempts?: number;
  createdAt?: number;
}> = {
  title: 'sync_queue schema',
  version: 2,
  type: 'object',
  primaryKey: 'id',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      maxLength: 255,
      description: 'Unique queue entry ID'
    },
    op: {
      type: 'string',
      enum: ['put', 'delete'],
      description: 'Operation type: put (update/create) or delete'
    },
    target: {
      type: 'string',
      enum: ['file'],
      description: 'Target collection'
    },
    targetId: {
      type: 'string',
      maxLength: 255,
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
      type: 'number',
      multipleOf: 1,
      minimum: 0,
      maximum: 253402300799999,
      default: 0,
      description: 'Queue entry creation time'
    }
  },
  required: ['id', 'op', 'target', 'targetId', 'createdAt'],
  indexes: ['createdAt']
};

/**
 * Migration strategies for schema version upgrades
 */
export const migrationStrategies = {
  cachedFile: {
    1: (doc: any) => doc,  // No-op migration from v0 to v1
    2: (doc: any) => doc,  // No-op migration from v1 to v2
    3: (doc: any) => {
      // Normalize older cached_file docs to canonical FileNode shape
      const out: any = { ...doc };

      // Map legacy type 'dir' -> 'directory'
      if (out.type === 'dir') out.type = 'directory';

      // Ensure timestamps are ISO strings
      if (out.lastModified !== undefined && out.lastModified !== null) {
        try {
          out.modifiedAt = new Date(Number(out.lastModified)).toISOString();
        } catch {
          out.modifiedAt = new Date().toISOString();
        }
      }
      if (!out.createdAt) out.createdAt = new Date().toISOString();

      // Move arbitrary metadata into `meta` property
      if (out.metadata && typeof out.metadata === 'object') {
        out.meta = { ...(out.meta || {}), ...out.metadata };
        delete out.metadata;
      }

      // Ensure children is array for directories
      if (out.type === 'directory') {
        out.children = Array.isArray(out.children) ? out.children : (out.children ? [out.children] : []);
      } else {
        delete out.children;
      }

      // Ensure synced flag exists
      if (out.synced === undefined) out.synced = out.dirty ? false : true;

      // Ensure workspaceId exists (nullable)
      if (out.workspaceId === undefined) out.workspaceId = null;

      // Clean up legacy fields
      delete out.lastModified;

      return out;
    }
  },
  // crdtDoc migrations removed
  syncQueue: {
    1: (doc: any) => doc,  // No-op migration from v0 to v1
    2: (doc: any) => doc   // No-op migration from v1 to v2
  }
};

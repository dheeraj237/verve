import type { RxJsonSchema } from 'rxdb';
import { SyncOp, WorkspaceType } from '../cache/types';
import type { FileNode } from '../../shared/types';
import Collections from './collections';

// File document stored in `files` collection
// Now uses unified FileNode type

export const fileSchema: RxJsonSchema<FileNode> = {
  title: 'files collection - unified FileNode schema',
  description: 'File metadata and content cache (supports lazy-loaded content)',
  type: 'object',
  primaryKey: 'id',
  version: 0, // Reset to 0 for tests; migrations handled in app logic
  required: [
    'id',
    'workspaceId',
    'workspaceType',
    'path',
    'name',
    'type',
    'dirty',
    'isSynced',
    'syncStatus',
    'version',
  ],
  properties: {
    // Core identity
    id: { type: 'string', maxLength: 1024 },
    path: { type: 'string', maxLength: 1024 },
    name: { type: 'string', maxLength: 1024 },

    // Type & hierarchy
    type: { type: 'string', maxLength: 64, enum: ['file', 'directory'] },
    parentId: { type: ['string', 'null'], maxLength: 1024 },
    children: {
      type: 'array',
      items: { type: 'object' },
      description: 'Nested FileNode objects for UI tree (built on-demand)',
    },

    // Content (lazy-loaded)
    content: { type: 'string', description: 'File content (lazy-loaded, may be omitted)' },
    contentHash: { type: 'string', maxLength: 256, description: 'SHA-256 hash for change detection' },

    // Metadata
    size: { type: 'number' },
    mimeType: { type: 'string', maxLength: 256 },
    metadata: { type: 'object', description: 'Adapter-specific metadata (e.g. Google Drive file ID)' },

    // Timestamps (normalized to ISO 8601)
    createdAt: { type: 'string', maxLength: 64 },
    modifiedAt: { type: 'string', maxLength: 64 },

    // Workspace context
    workspaceId: { type: 'string', maxLength: 1024 },
    workspaceType: { type: 'string', maxLength: 64 },

    // Sync state
    dirty: { type: 'boolean' },
    isSynced: { type: 'boolean' },
    syncStatus: {
      type: 'string',
      maxLength: 64,
      enum: ['idle', 'syncing', 'conflict', 'error'],
    },
    version: { type: 'number' },

    // Editor support
    isLocal: { type: 'boolean' },
    fileHandle: { type: 'object', description: 'Browser File System API handle (serialized)' },
  },
  indexes: [
    // Single field indexes
    ['workspaceId'], // Fast: files in a workspace
    // Composite indexes for common queries
    ['workspaceId', 'path'], // Fast: find by path in workspace
    ['workspaceId', 'type'], // Fast: list directories/files only
    ['workspaceId', 'syncStatus'], // Fast: find syncing/conflicted files
  ],
};

// Workspace document stored in `workspaces` collection
export interface WorkspaceDoc {
  id: string; // PK
  name: string;
  type: WorkspaceType;
  path?: string;
  driveFolder?: string;
  createdAt: string;
  lastAccessed?: string;
}

export const workspaceSchema: RxJsonSchema<WorkspaceDoc> = {
  title: 'workspaces schema',
  description: 'Workspace metadata',
  type: 'object',
  primaryKey: 'id',
  version: 0,
  required: ['id', 'name', 'type', 'createdAt'],
  properties: {
    id: { type: 'string', maxLength: 1024 },
    name: { type: 'string' },
    type: { type: 'string' },
    path: { type: 'string' },
    driveFolder: { type: 'string' },
    createdAt: { type: 'string' },
    lastAccessed: { type: 'string' }
  }
};

// Settings collection
export interface SettingDoc {
  id: string; // key
  key: string;
  value: any;
  updatedAt: number;
}

export const settingsSchema: RxJsonSchema<SettingDoc> = {
  title: 'settings schema',
  description: 'App and user settings',
  type: 'object',
  primaryKey: 'id',
  version: 0,
  required: ['id', 'key', 'value', 'updatedAt'],
  properties: {
    id: { type: 'string', maxLength: 1024 },
    key: { type: 'string' },
    value: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
    updatedAt: { type: 'number' }
  }
};

// directory_handles_meta collection
export interface DirectoryHandleMeta {
  id: string; // PK = workspaceId
  workspaceId: string;
  directoryName: string;
  storedAt: number;
  permissionStatus: 'granted' | 'prompt' | 'denied' | string;
  notes?: string;
  directoryHandle?: any;
}

export const directoryHandleSchema: RxJsonSchema<DirectoryHandleMeta> = {
  title: 'directory handles meta',
  type: 'object',
  primaryKey: 'id',
  version: 0,
  required: ['id', 'workspaceId', 'directoryName', 'storedAt', 'permissionStatus'],
  properties: {
    id: { type: 'string', maxLength: 1024 },
    workspaceId: { type: 'string' },
    directoryName: { type: 'string' },
    storedAt: { type: 'number' },
    permissionStatus: { type: 'string' },
    notes: { type: 'string' },
    directoryHandle: { type: 'object' }
  }
};

// sync_queue collection
export interface SyncQueueDoc {
  id: string;
  op: SyncOp;
  target: string; // e.g., 'file'
  targetId: string;
  payload?: any;
  createdAt: number;
  attempts?: number;
}

export const syncQueueSchema: RxJsonSchema<SyncQueueDoc> = {
  title: 'sync queue schema',
  type: 'object',
  primaryKey: 'id',
  version: 0,
  required: ['id', 'op', 'target', 'targetId', 'createdAt'],
  properties: {
    id: { type: 'string', maxLength: 1024 },
    op: { type: 'string' },
    target: { type: 'string' },
    targetId: { type: 'string' },
    payload: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
    createdAt: { type: 'number' },
    attempts: { type: 'number' }
  }
};

export const collections = {
  files: { name: Collections.Files, schema: fileSchema },
  workspaces: { name: Collections.Workspaces, schema: workspaceSchema },
  settings: { name: Collections.Settings, schema: settingsSchema },
  directory_handles_meta: { name: Collections.DirectoryHandlesMeta, schema: directoryHandleSchema },
  sync_queue: { name: Collections.SyncQueue, schema: syncQueueSchema }
} as const;

export type CollectionsMap = typeof collections;

// export { fileSchema, workspaceSchema, settingsSchema, directoryHandleSchema, syncQueueSchema };

import type { RxJsonSchema } from 'rxdb';
import { FileType, SyncOp, WorkspaceType } from '../cache/types';
import Collections from './collections';

// File document stored in `files` collection
export interface FileDoc {
  id: string; // primary key: `${workspaceId}:${path}`
  workspaceId: string;
  workspaceType: WorkspaceType;
  // `type` is used throughout the codebase (FileType.File | FileType.Dir)
  type: FileType;
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  lastModified: number;
  size?: number;
  mimeType?: string;
  syncStatus?: 'idle' | 'syncing' | 'conflict' | 'error' | string;
  version?: number;
}

export const fileSchema: RxJsonSchema<FileDoc> = {
  title: 'files schema',
  description: 'File metadata and content cache',
  type: 'object',
  primaryKey: 'id',
  required: ['id', 'workspaceId', 'workspaceType', 'path', 'name', 'content', 'dirty', 'lastModified', 'type'],
  properties: {
    id: { type: 'string', maxLength: 1024 },
    workspaceId: { type: 'string', maxLength: 1024 },
    workspaceType: { type: 'string' },
    type: { type: 'string', maxLength: 64 },
    path: { type: 'string', maxLength: 1024 },
    name: { type: 'string' },
    content: { type: 'string' },
    dirty: { type: 'boolean' },
    lastModified: { type: 'number' },
    size: { type: 'number' },
    mimeType: { type: 'string' },
    syncStatus: { type: 'string', maxLength: 1024 },
    version: { type: 'number' }
  },
  // Note: Dexie storage does not support boolean indexes; omit `dirty` from
  // indexed fields to remain compatible while still allowing queries on it.
  indexes: ['workspaceId', 'path', 'syncStatus'],
  version: 0
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

/**
 * File Manager - RxDB-backed file and directory operations
 *
 * Migrated from the legacy `file-operations.ts`. This module owns file CRUD,
 * folder helpers, watching/subscriptions and sample loading. It delegates
 * direct DB interactions to `rxdb.ts` helpers.
 */

import { v4 as uuidv4 } from 'uuid';
import type { FileDoc } from '@/core/rxdb/schemas';
import { enqueueSyncEntry } from '@/core/sync/sync-queue-processor';
import { SyncOp } from './types';
import { CachedFile, WorkspaceType, FileType } from './types';

import { initializeRxDB, getCacheDB, upsertDoc as clientUpsertDoc, getDoc as clientGetDoc, findDocs as clientFindDocs, atomicUpsert as clientAtomicUpsert, removeDoc as clientRemoveDoc, subscribeQuery as clientSubscribeQuery } from '@/core/rxdb/rxdb-client';
const client = await import('@/core/rxdb/rxdb-client');
await client.createRxDB();
const col = client.getCollection(collectionName as any);
if (typeof col.upsert === 'function') return await col.upsert(doc);
return client.upsertDoc(collectionName as any, doc as any);
            },
remove: async (arg: any) => {
  const client = await import('@/core/rxdb/rxdb-client');
  await client.createRxDB();
  const col = client.getCollection(collectionName as any);
  if (arg) {
    const d = await col.findOne(arg).exec();
    if (d && typeof d.remove === 'function') await d.remove();
  } else {
    const docs = await col.find({}).exec();
    for (const d of docs) if (d && typeof d.remove === 'function') await d.remove();
  }
}
          } as any;
        };
 * Ensure parent folder documents exist for a given path.
 */
async function ensureParentFoldersForPath(path: string, workspaceType: WorkspaceType = WorkspaceType.Browser, workspaceId?: string): Promise<void> {
  const norm = normalizePath(path);
  if (!norm) return;
  const parts = norm.split('/');
  if (parts.length <= 1) return;

  for (let i = 0; i < parts.length - 1; i++) {
    const folderPath = parts.slice(0, i + 1).join('/');
    try {
      const existing = await getCachedFile(folderPath, workspaceId);
      if (existing && existing.type === FileType.Dir) continue;

      const id = uuidv4();
      const name = folderPath.split('/').pop() || folderPath || 'untitled';
      const dir: CachedFile = {
        id,
        name,
        path: folderPath,
        type: FileType.Dir,
        workspaceType: workspaceType,
        workspaceId: workspaceId,
        lastModified: Date.now(),
        dirty: false,
      };

      await upsertCachedFile(dir);
      console.info(`[RxDB] ensureParentFoldersForPath created dir='${folderPath}' id='${id}' workspaceId='${workspaceId}'`);
    } catch (e) {
      console.warn('ensureParentFoldersForPath failed for', folderPath, e);
    }
  }
}

function toCacheWorkspaceType(wsType: WorkspaceType | string): WorkspaceType {
  if (wsType === 'drive' || wsType === 'gdrive') return 'gdrive' as WorkspaceType;
  if (typeof wsType === 'string') return wsType as WorkspaceType;
  return wsType as WorkspaceType;
}

export interface FileData {
  id: string;
  name: string;
  path: string;
  content: string;
  metadata?: Record<string, any>;
  mimeType?: string;
  lastModified?: number;
}

export async function existsInWorkspace(path: string, workspaceId?: string): Promise<boolean> {
  try {
    const cached = await getCachedFile(path, workspaceId);
    if (!cached) return false;
    if (workspaceId) return String(cached.workspaceId) === String(workspaceId);
    return true;
  } catch (err) {
    console.warn('existsInWorkspace check failed:', err);
    return false;
  }
}

export async function existsInWorkspaceType(path: string, workspaceType: WorkspaceType | string, workspaceId?: string): Promise<boolean> {
  try {
    const cacheType = toCacheWorkspaceType(workspaceType as any);
    const cached = await getCachedFile(path, workspaceId);
    if (!cached) return false;
    if (workspaceId && String(cached.workspaceId) !== String(workspaceId)) return false;
    return String(cached.workspaceType) === String(cacheType);
  } catch (err) {
    console.warn('existsInWorkspaceType check failed:', err);
    return false;
  }
}

export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  type: FileType;
  size?: number;
  mimeType?: string;
  lastModified?: number;
  dirty?: boolean;
  workspaceType: WorkspaceType;
  workspaceId?: string;
}

export async function initializeFileOperations(): Promise<void> {
  console.log('[FileOperations] Initializing...');
  try {
    await initializeRxDB();
    try {
      await ensureFolderDocs();
      console.info('[FileOperations] ensureFolderDocs migration completed');
    } catch (e) {
      console.warn('[FileOperations] ensureFolderDocs migration failed', e);
    }
    console.log('[FileOperations] Initialized successfully');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[FileOperations] Initialization failed:', errorMsg);
    if (errorMsg.includes('Clear browser storage')) {
      console.error('[FileOperations] Schema update detected. Please clear IndexedDB and reload:');
      console.error('1. Open DevTools (F12)');
      console.error('2. Go to Application tab');
      console.error('3. Clear IndexedDB');
      console.error('4. Reload the page');
    }
    throw err;
  }
}

export async function loadFile(
  path: string,
  workspaceType: WorkspaceType | string = WorkspaceType.Browser,
  workspaceId?: string
): Promise<FileData> {
  const cacheType = toCacheWorkspaceType(workspaceType as any);
  return loadFileSync(path, cacheType, workspaceId);
}

async function loadFileSync(path: string, workspaceType: WorkspaceType = WorkspaceType.Browser, workspaceId?: string): Promise<FileData> {
  const db = await getCacheDB();
  const cached = await getCachedFile(path, workspaceId);
  if (cached) {
    // Prefer retrieving the canonical doc by id from rxdb-client
    const doc = (await getDoc<FileDoc>('files', cached.id)) || (cached as unknown as FileDoc);
    const content = doc.content || '';
    return {
      id: doc.id,
      name: doc.name,
      path: doc.path,
      content,
      metadata: (doc as any).metadata,
      lastModified: doc.lastModified,
    };
  }
  return {
    id: uuidv4(),
    name: path.split('/').pop() || 'untitled',
    path,
    content: '',
    lastModified: Date.now(),
  };
}

export function saveFile(
  path: string,
  content: string,
  workspaceType: WorkspaceType | string = 'browser',
  metadata?: Record<string, any>,
  workspaceId?: string
): Promise<FileData> {
  const cacheType = toCacheWorkspaceType(workspaceType as any);
  return saveSyncFile(path, content, cacheType, metadata, workspaceId);
}

async function saveSyncFile(
  path: string,
  content: string,
  workspaceType: WorkspaceType = 'browser' as WorkspaceType,
  metadata?: Record<string, any>,
  workspaceId?: string
): Promise<FileData> {
  const db = await getCacheDB();
  let fileId: string;
  const existing = await getCachedFile(path, workspaceId);
  if (existing) {
    fileId = existing.id;
  } else {
    fileId = uuidv4();
  }
  try {
    await ensureParentFoldersForPath(path, workspaceType, workspaceId);
  } catch (e) {
    console.warn('Failed to ensure parent folders for path', path, e);
  }
  // Use atomicUpsert to safely increment version and avoid races
  const name = path.split('/').pop() || 'untitled';
  const mutator = (current?: any) => {
    const nextVersion = (current && current.version ? current.version : 0) + 1;
    return {
      ...(current || {}),
      id: fileId,
      name,
      path,
      type: FileType.File,
      workspaceType,
      workspaceId: workspaceId,
      content,
      metadata: metadata || { mimeType: 'text/markdown' },
      lastModified: Date.now(),
      dirty: String(workspaceType) !== WorkspaceType.Browser,
      version: nextVersion,
    } as CachedFile;
  };
  try {
    const preview = typeof content === 'string' ? content.slice(0, 200) : '';
    console.info(`[RxDB] saveFile path='${path}' workspaceType='${workspaceType}' workspaceId='${workspaceId}' contentPreview='${preview.replace(/\n/g, '\\n')}'`);
  } catch (e) {
    console.warn('[RxDB] saveFile logging failed', e);
  }

  const saved = await atomicUpsert<FileDoc>('files', fileId, mutator as any);
  try {
    // Ensure final doc persisted (shim-safe)
    await upsertDoc<FileDoc>('files', saved as any);
  } catch (e) {
    // Non-fatal: atomicUpsert already persisted via underlying helpers
  }

  return {
    id: (saved as any).id,
    name: (saved as any).name,
    path: (saved as any).path,
    content: (saved as any).content,
    metadata: (saved as any).metadata,
    lastModified: (saved as any).lastModified,
  };
}

/**
 * Get the raw `FileDoc` for a path (or id) scoped to an optional workspace.
 * Returns `null` if not found.
 */
export async function getFile(pathOrId: string, workspaceId?: string): Promise<FileDoc | null> {
  const cached = await getCachedFile(pathOrId, workspaceId);
  if (!cached) return null;
  const doc = await getDoc<FileDoc>('files', cached.id);
  return doc;
}

export async function deleteFile(path: string, workspaceId?: string): Promise<void> {
  const db = await getCacheDB();
  const cached = await getCachedFile(path, workspaceId);
  if (cached) {
    try {
      if (cached.type === FileType.Dir) {
        const norm = (cached.path || '').replace(/^\/*/, '').replace(/\/*$/, '');
        let selector: any;
        if (!norm) {
          selector = {};
        } else {
          const esc = norm.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
          selector = { path: { $regex: `^${esc}(?:$|/)` } };
        }
        if (workspaceId) selector = { ...selector, workspaceId };
        const docs = await db.cached_files.find({ selector }).exec();
        for (const d of docs) {
          try {
            await d.remove();
          } catch (remErr) {
            console.warn('Failed to remove cached doc during folder delete:', remErr);
            try {
              await db.cached_files.find().where('id').eq(d.id).remove();
            } catch (_) { /* swallow */ }
          }
          try {
            if (String(d.workspaceType) !== WorkspaceType.Browser) {
              await enqueueSyncEntry({
                op: SyncOp.Delete,
                target: 'file',
                targetId: d.id,
                payload: { path: d.path, workspaceType: d.workspaceType, workspaceId: d.workspaceId }
              });
            }
          } catch (e) {
            console.warn('Failed to enqueue delete sync entry for child:', e);
          }
        }
      } else {
        const doc = await db.cached_files.findOne(cached.id).exec();
        if (doc && typeof doc.remove === 'function') {
          await doc.remove();
        } else {
          await db.cached_files.find().where('id').eq(cached.id).remove();
        }
        try {
          if (String(cached.workspaceType) !== WorkspaceType.Browser) {
            await enqueueSyncEntry({
              op: SyncOp.Delete,
              target: 'file',
              targetId: cached.id,
              payload: { path: cached.path, workspaceType: cached.workspaceType, workspaceId: cached.workspaceId }
            });
          }
        } catch (e) {
          console.warn('Failed to enqueue delete sync entry:', e);
        }
      }
    } catch (err) {
      console.warn('deleteFile fallback remove failed:', err);
      await db.cached_files.find().where('id').eq(cached.id).remove().catch(() => { });
    }
  }
}

export async function renameFile(oldPath: string, newPath: string, workspaceId?: string): Promise<void> {
  const cached = await getCachedFile(oldPath, workspaceId);
  if (!cached) {
    throw new Error(`File not found: ${oldPath}`);
  }
  const newName = newPath.split('/').pop() || 'untitled';
  await upsertCachedFile({
    ...cached,
    path: newPath,
    name: newName,
    dirty: cached.dirty || String(cached.workspaceType) !== WorkspaceType.Browser,
  });
}

export async function createDirectory(
  path: string,
  workspaceType: WorkspaceType | 'browser' | 'local' | 'drive' | 'gdrive' | 's3' = WorkspaceType.Browser,
  workspaceId?: string
): Promise<FileMetadata> {
  const cacheType = toCacheWorkspaceType(workspaceType as any);
  return createDirectorySync(path, cacheType, workspaceId);
}

async function createDirectorySync(path: string, workspaceType: WorkspaceType = WorkspaceType.Browser, workspaceId?: string): Promise<FileMetadata> {
  const norm = normalizePath(path);
  const dirName = norm.split('/').pop() || 'untitled';
  const storedPath = path && path.startsWith('/') ? path : `/${norm}`;

  const existing = await getCachedFile(norm, workspaceId);
  if (existing && existing.type === FileType.Dir) {
    return {
      id: existing.id,
      name: existing.name,
      path: existing.path,
      type: FileType.Dir,
      workspaceType: existing.workspaceType,
      lastModified: existing.lastModified,
    };
  }

  const dirId = uuidv4();
  const dir: CachedFile = {
    id: dirId,
    name: dirName,
    path: storedPath,
    type: FileType.Dir,
    workspaceType,
    workspaceId: workspaceId,
    lastModified: Date.now(),
    dirty: String(workspaceType) !== WorkspaceType.Browser,
  };
  try {
    console.info(`[RxDB] createDirectory path='${path}' workspaceType='${workspaceType}' workspaceId='${workspaceId}'`);
  } catch (e) {
    console.warn('[RxDB] createDirectory logging failed', e);
  }
  await upsertCachedFile(dir);
  return {
    id: dirId,
    name: dirName,
    path: storedPath,
    type: FileType.Dir,
    workspaceType,
    lastModified: dir.lastModified,
  };
}

export async function listFiles(dirPath: string = '', workspaceId?: string): Promise<FileMetadata[]> {
  const db = await getCacheDB();
  const normalizedPath = (dirPath === '/' || dirPath === '') ? '' : dirPath.replace(/\/$/, '').replace(/^\//, '');
  const pattern = normalizedPath ? `${normalizedPath}/` : '';
  let allFilesQuery: any = db.cached_files.find();
  if (workspaceId) {
    allFilesQuery = allFilesQuery.where('workspaceId').eq(workspaceId);
  }
  const allFiles = await allFilesQuery.exec();
  const children = allFiles.filter(file => {
    const storedPath = file.path ? (file.path.startsWith('/') ? file.path.slice(1) : file.path) : '';
    if (!storedPath.startsWith(pattern)) {
      return false;
    }
    const relativePath = storedPath.slice(pattern.length);
    return !relativePath.includes('/');
  });
  return children.map(file => ({
    id: file.id,
    name: file.name,
    path: file.path,
    type: file.type,
    workspaceType: file.workspaceType,
    workspaceId: file.workspaceId,
    dirty: file.dirty,
    lastModified: file.lastModified,
  }));
}

export async function getAllFiles(workspaceId?: string): Promise<FileMetadata[]> {
  const db = await getCacheDB();
  let query: any = db.cached_files.find();
  if (workspaceId) {
    query = query.where('workspaceId').eq(workspaceId);
  }
  const allFiles = await query.exec();
  return allFiles.map(file => ({
    id: file.id,
    name: file.name,
    path: file.path,
    type: file.type,
    workspaceType: file.workspaceType,
    workspaceId: file.workspaceId,
    dirty: file.dirty,
    lastModified: file.lastModified,
  }));
}

export async function ensureFolderDocs(workspaceId?: string): Promise<void> {
  const db = await getCacheDB();
  const allFiles = await getAllFiles(workspaceId);
  const folderSet = new Set<string>();
  for (const f of allFiles) {
    const raw = f.path || '';
    const normalized = normalizePath(raw);
    if (!normalized) continue;
    const parts = normalized.split('/');
    for (let i = 0; i < Math.max(0, parts.length - 1); i++) {
      const seg = parts.slice(0, i + 1).join('/');
      folderSet.add(seg);
    }
  }
  if (folderSet.size === 0) return;
  let query: any = db.cached_files.find().where('type').eq(FileType.Dir);
  if (workspaceId) query = query.where('workspaceId').eq(workspaceId);
  const existingDirs = await query.exec();
  const existingPaths = new Set(existingDirs.map((d: any) => normalizePath(d.path || '')));
  const sample = allFiles.find(() => true);
  const wsType = sample ? (sample.workspaceType as WorkspaceType) : WorkspaceType.Browser;
  for (const folderPath of Array.from(folderSet)) {
    if (existingPaths.has(folderPath)) continue;
    const id = uuidv4();
    const name = folderPath.split('/').pop() || folderPath || 'untitled';
    const dir: CachedFile = {
      id,
      name,
      path: folderPath,
      type: FileType.Dir,
      workspaceType: wsType,
      workspaceId: workspaceId,
      lastModified: Date.now(),
      dirty: false,
    };
    try {
      await upsertCachedFile(dir);
      console.info(`[RxDB] ensureFolderDocs created dir='${folderPath}' id='${id}' workspaceId='${workspaceId}'`);
    } catch (e) {
      console.warn('ensureFolderDocs failed to create dir', folderPath, e);
    }
  }
}

export async function getDirtyFiles(workspaceId?: string): Promise<FileMetadata[]> {
  const db = await getCacheDB();
  let query: any = db.cached_files.find().where('dirty').eq(true);
  if (workspaceId) {
    query = query.where('workspaceId').eq(workspaceId);
  }
  const dirtyFiles = await query.exec();
  return dirtyFiles.map(file => ({
    id: file.id,
    name: file.name,
    path: file.path,
    type: file.type,
    workspaceType: file.workspaceType,
    workspaceId: file.workspaceId,
    dirty: file.dirty,
    lastModified: file.lastModified,
  }));
}

export async function markFileSynced(fileId: string): Promise<void> {
  const db = await getCacheDB();
  const file = await db.cached_files.findOne(fileId).exec();
  if (file) {
    await db.cached_files.upsert({
      ...(file.toJSON() as any),
      dirty: false,
    } as any);
  }
}

export function watchDirectory(dirPath: string = ''): any {
  return new Promise((resolve) => {
    const subscription = observeCachedFiles((files) => {
      if (dirPath) {
        resolve(files.filter(f => f.path.startsWith(dirPath)));
      } else {
        resolve(files);
      }
    });
    return subscription;
  });
}

export function subscribeToFileChanges(callback: (files: FileMetadata[]) => void): () => void {
  const subscription = observeCachedFiles((files: any) => {
    callback(files as FileMetadata[]);
  });
  return () => subscription.unsubscribe();
}

export async function clearAllFiles(): Promise<void> {
  const db = await getCacheDB();
  await db.cached_files.find().remove();
}

export async function switchWorkspaceType(newType: WorkspaceType): Promise<void> {
  const db = await getCacheDB();
  const allFiles = await db.cached_files.find().exec();
  for (const file of allFiles) {
    const jsonFile = file.toJSON() as any;
    await db.cached_files.upsert({
      ...(jsonFile as any),
      workspaceType: newType,
      dirty: String(newType) !== WorkspaceType.Browser, // Mark dirty for non-browser workspaces
    } as any);
  }
}

export async function loadSampleFilesFromFolder(): Promise<void> {
  const sampleFiles = [
    { path: '/01-basic-formatting.md', name: '01-basic-formatting.md' },
    { path: '/02-lists-and-tasks.md', name: '02-lists-and-tasks.md' },
    { path: '/03-code-blocks.md', name: '03-code-blocks.md' },
    { path: '/04-tables-and-quotes.md', name: '04-tables-and-quotes.md' },
    { path: '/05-collapsable-sections.md', name: '05-collapsable-sections.md' },
    { path: '/06-mermaid-diagrams.md', name: '06-mermaid-diagrams.md' },
    { path: '/07-advanced-features.md', name: '07-advanced-features.md' },
    { path: '/08-link-navigation.md', name: '08-link-navigation.md' },
    { path: '/content1/test-feature-link-navigation.md', name: 'test-feature-link-navigation.md' },
    { path: '/notes-101/notes.md', name: 'notes.md' },
  ];

  console.log('[FileOperations] Loading sample files (browser-only fetch)...');

  try {
    for (const sample of sampleFiles) {
      try {
        const response = await fetch(`/content${sample.path}`);
        if (!response.ok) {
          console.warn(`[FileOperations] Failed to load ${sample.path}: ${response.status}`);
          continue;
        }
        const ct = (response.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('text/html')) {
          console.warn(`[FileOperations] Skipping ${sample.path} due to HTML response`);
          continue;
        }
        const content = await response.text();

        const fileId = `verve-samples-${sample.path}`;

        await upsertCachedFile({
          id: fileId,
          name: sample.name,
          path: sample.path,
          type: FileType.File,
          workspaceType: WorkspaceType.Browser,
          workspaceId: 'verve-samples',
          content,
          lastModified: Date.now(),
          dirty: false,
        });

        console.log(`[FileOperations] Loaded sample file: ${sample.path}`);
      } catch (err) {
        console.error(`[FileOperations] Error loading sample file ${sample.path}:`, err);
      }
    }

    console.log('[FileOperations] Sample files loading complete');
  } catch (error) {
    console.error('[FileOperations] Error loading sample files:', error);
    throw error;
  }
}

/**
 * Workspace-scoped subscription helper for the UI.
 * This returns an unsubscribe function.
 */
export function subscribeToWorkspaceFiles(workspaceId: string | null, callback: (files: FileMetadata[]) => void): () => void {
  const sub = observeCachedFiles((files: CachedFile[]) => {
    try {
      const filtered = workspaceId ? files.filter(f => String(f.workspaceId) === String(workspaceId)) : files;
      callback(filtered as FileMetadata[]);
    } catch (e) {
      console.warn('[file-manager] Error in subscribeToWorkspaceFiles callback', e);
    }
  });
  return () => {
    try { sub.unsubscribe(); } catch (e) { /* ignore */ }
  };
}

export function observeWorkspaceFiles(workspaceId: string | null) {
  return {
    subscribe: (cb: (files: FileMetadata[]) => void) => {
      const unsub = subscribeToWorkspaceFiles(workspaceId, cb);
      return { unsubscribe: unsub };
    }
  };
}


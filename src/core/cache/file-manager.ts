/**
 * File Manager - RxDB-backed file and directory operations
 *
 * Migrated from the legacy `file-operations.ts`. This module owns file CRUD,
 * folder helpers, watching/subscriptions and sample loading. It delegates
 * direct DB interactions to `rxdb.ts` helpers.
 */

import { v4 as uuidv4 } from 'uuid';
import { SyncOp, WorkspaceType, FileType } from './types';
import type { FileNode } from '@/shared/types';

import { initializeRxDB as rxInitializeRxDB, getCacheDB as rxGetCacheDB, upsertDoc as rxUpsertDoc, getDoc as rxGetDoc, findDocs as rxFindDocs, atomicUpsert as rxAtomicUpsert, removeDoc as rxRemoveDoc, subscribeQuery as rxSubscribeQuery } from '@/core/rxdb/rxdb-client';
import Collections from '@/core/rxdb/collections';
import { normalizePath } from '@/shared/utils/file-path-resolver';
import { SyncStatus } from '../sync';

// Local aliases to keep calls concise and avoid indirect circular-init problems.
const upsertDoc = rxUpsertDoc;
const getDoc = rxGetDoc;
const findDocs = rxFindDocs;
const atomicUpsert = rxAtomicUpsert;
const removeDoc = rxRemoveDoc;
const subscribeQuery = rxSubscribeQuery;

// Export thin wrappers so other modules can import `initializeRxDB`/`getCacheDB`
// from this file without creating import-time cycles.
export async function initializeRxDB(): Promise<void> { return rxInitializeRxDB(); }
export function getCacheDB(): any { return rxGetCacheDB(); }

export async function upsertCachedFile(doc: FileNode): Promise<void> {
  await initializeRxDB();
  try {
    console.debug('[file-manager] upsertCachedFile id=%s path=%s', doc.id, doc.path);
  } catch (_) { }
  return upsertDoc((Collections as any).Files, doc as any);
}

export async function getCachedFile(pathOrId: string, workspaceId?: string): Promise<FileNode | null> {
  // try by id first
  await initializeRxDB();
  try {
    const byId = await getDoc((Collections as any).Files, pathOrId as any);
    if (byId && (!workspaceId || String((byId as any).workspaceId) === String(workspaceId))) return byId as any;
  } catch (_) { /* ignore */ }
  // Try exact path matches for several common stored forms: raw, normalized, and
  // with a leading slash. This covers creation paths like `/foo` vs `foo`.
  const norm = normalizePath(pathOrId || '');
  const candidates = Array.from(new Set([pathOrId, norm, norm ? `/${norm}` : ''].filter(Boolean)));
  for (const candidate of candidates) {
    try {
      const sel: any = { path: candidate };
      if (workspaceId) sel.workspaceId = workspaceId;
      const found = await findDocs((Collections as any).Files, { selector: sel });
      if (found && found.length) return (found[0] as any);
    } catch (_) { /* ignore individual candidate errors */ }
  }

  // Debug: list all IDs if nothing found (helps in failing tests)
  try {
    const all = await findDocs((Collections as any).Files, { selector: {} });
    try { console.debug('[file-manager] getCachedFile allIds=', JSON.stringify((all || []).map((a: any) => a.id))); } catch (_) { }
  } catch (_) { }

  // Fallback: try a regex-match on path endings (handles leading-slash variants)
  try {
    const esc = (pathOrId || '').replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const regexSel: any = { path: { $regex: `${esc}$` } };
    if (workspaceId) regexSel.workspaceId = workspaceId;
    const regexFound = await findDocs((Collections as any).Files, { selector: regexSel });
    if (regexFound && regexFound.length) return regexFound[0] as any;
  } catch (_) { /* ignore */ }

  return null;
}

export async function getAllCachedFiles(workspaceId?: string): Promise<FileNode[]> {
  await initializeRxDB();
  const selector = workspaceId ? { workspaceId } : {};
  return findDocs((Collections as any).Files, { selector }) as Promise<FileNode[]>;
}

export function observeCachedFiles(cb: (files: FileNode[]) => void): { unsubscribe: () => void } {
  let unsubFn: (() => void) | null = null;
  (async () => {
    await initializeRxDB();
    unsubFn = subscribeQuery((Collections as any).Files, { selector: {} }, (docs: any[]) => cb(docs as FileNode[]));
  })();
  return { unsubscribe: () => { try { if (unsubFn) unsubFn(); } catch (_) { } } };
}

export async function getDirtyCachedFiles(workspaceId?: string): Promise<FileNode[]> {
  await initializeRxDB();
  const selector: any = { dirty: true };
  if (workspaceId) selector.workspaceId = workspaceId;
  return findDocs((Collections as any).Files, { selector }) as Promise<FileNode[]>;
}

export async function markCachedFileAsSynced(fileId: string): Promise<void> {
  await initializeRxDB();
  try {
    await atomicUpsert((Collections as any).Files, fileId as any, (current?: any) => ({ ...(current || {}), id: fileId, dirty: false }));
  } catch (e) {
    const doc = await getDoc((Collections as any).Files, fileId as any);
    if (doc) await upsertDoc((Collections as any).Files, { ...(doc as any), dirty: false } as any);
  }
}

export async function removeCachedFile(fileId: string): Promise<void> {
  await initializeRxDB();
  return removeDoc((Collections as any).Files, fileId as any);
}

export async function closeCacheDB(): Promise<void> {
  try {
    await initializeRxDB();
    const files = await findDocs((Collections as any).Files, { selector: {} });
    for (const f of files) {
      try { await removeDoc((Collections as any).Files, f.id); } catch (_) { }
    }
    const queue = await findDocs((Collections as any).SyncQueue, { selector: {} });
    for (const q of queue) { try { await removeDoc((Collections as any).SyncQueue, q.id); } catch (_) { } }
    if (typeof indexedDB !== 'undefined' && (indexedDB as any).deleteDatabase) {
      try { (indexedDB as any).deleteDatabase('verve'); } catch (_) { }
    }
  } catch (e) { /* ignore cleanup errors */ }
}

/* Ensure parent folder documents exist for a given path. */
/* The DB read/write/query logic lives in `rxdb-client.ts`. This module
   delegates persistence to those helpers and keeps only business logic. */
async function ensureParentFoldersForPath(path: string, workspaceType: WorkspaceType = WorkspaceType.Browser, workspaceId?: string): Promise<void> {
  const norm = normalizePath(path);
  if (!norm) return;
  const parts = norm.split('/');
  if (parts.length <= 1) return;

  for (let i = 0; i < parts.length - 1; i++) {
    const folderPath = parts.slice(0, i + 1).join('/');
    try {
      const existing = await getCachedFile(folderPath, workspaceId);
      if (existing && existing.type === FileType.Directory) continue;

      const id = uuidv4();
      const name = folderPath.split('/').pop() || folderPath || 'untitled';
      const dir: FileNode = {
        id,
        name,
        path: folderPath,
        type: FileType.Directory,
        workspaceType: workspaceType,
        workspaceId: workspaceId,
        modifiedAt: new Date().toISOString(),
        dirty: false,
        isSynced: true,
        syncStatus: 'idle',
        version: 0,
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
  modifiedAt?: string;
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
  try { console.debug('[file-manager] loadFileSync cached=', JSON.stringify(cached)); } catch (_) { }
  if (cached) {
    // Prefer retrieving the canonical doc by id from rxdb-client
    const doc = (await getDoc<FileNode>('files', cached.id)) || (cached as unknown as FileNode);
    try { console.debug('[file-manager] loadFileSync doc=', JSON.stringify(doc)); } catch (_) { }
    const content = doc.content || '';
    return {
      id: doc.id,
      name: doc.name,
      path: doc.path,
      content,
      metadata: (doc as any).meta || (doc as any).metadata,
      mimeType: doc.mimeType,
    };
  }
  return {
    id: uuidv4(),
    name: path.split('/').pop() || 'untitled',
    path,
    content: '',
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
      meta: metadata || { mimeType: 'text/markdown' },
      modifiedAt: new Date().toISOString(),
      dirty: String(workspaceType) !== WorkspaceType.Browser,
      isSynced: false,
      syncStatus: 'idle',
      version: nextVersion,
    } as FileNode;
  };
  try {
    const preview = typeof content === 'string' ? content.slice(0, 200) : '';
    console.info(`[RxDB] saveFile path='${path}' workspaceType='${workspaceType}' workspaceId='${workspaceId}' contentPreview='${preview.replace(/\n/g, '\\n')}'`);
  } catch (e) {
    console.warn('[RxDB] saveFile logging failed', e);
  }

  const saved = await atomicUpsert<FileNode>('files', fileId, mutator as any);
  try { console.debug('[file-manager] saveSyncFile saved=', JSON.stringify(saved)); } catch (_) { }
  try {
    // Ensure final doc persisted (shim-safe)
    await upsertDoc<FileNode>('files', saved as any);
  } catch (e) {
    // Non-fatal: atomicUpsert already persisted via underlying helpers
  }

  return {
    id: (saved as any).id,
    name: (saved as any).name,
    path: (saved as any).path,
    content: (saved as any).content,
    metadata: (saved as any).meta || (saved as any).metadata,
    mimeType: (saved as any).mimeType,
  };
}

/**
 * Get the raw `FileDoc` for a path (or id) scoped to an optional workspace.
 * Returns `null` if not found.
 */
export async function getFile(pathOrId: string, workspaceId?: string): Promise<FileNode | null> {
  const cached = await getCachedFile(pathOrId, workspaceId);
  if (!cached) return null;
  const doc = await getDoc<FileNode>('files', cached.id);
  return doc;
}

export async function deleteFile(path: string, workspaceId?: string): Promise<void> {
  const db = await getCacheDB();
  const cached = await getCachedFile(path, workspaceId);
  if (cached) {
    try {
      if (cached.type === FileType.Directory) {
        const norm = (cached.path || '').replace(/^\/*/, '').replace(/\/*$/, '');
        let selector: any;
        if (!norm) {
          selector = {};
        } else {
          const esc = norm.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
          selector = { path: { $regex: `^${esc}(?:$|/)` } };
        }
        if (workspaceId) selector = { ...selector, workspaceId };
        const docs = await findDocs((Collections as any).Files, { selector }) as any[];
        for (const d of docs) {
          try {
              await removeDoc((Collections as any).Files, d.id);
            } catch (remErr) {
              console.warn('Failed to remove cached doc during folder delete:', remErr);
            try { await removeDoc((Collections as any).Files, d.id); } catch (_) { /* swallow */ }
          }
          try {
            if (String(d.workspaceType) !== WorkspaceType.Browser) {
              const { enqueueSyncEntry } = await import('@/core/sync/sync-queue-processor');
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
        try {
          await removeDoc((Collections as any).Files, cached.id);
        } catch (e) {
          console.warn('deleteFile fallback remove failed:', e);
        }
        try {
          if (String(cached.workspaceType) !== WorkspaceType.Browser) {
            const { enqueueSyncEntry } = await import('@/core/sync/sync-queue-processor');
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
      try { await removeDoc((Collections as any).Files, cached.id); } catch (_) { }
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
  if (existing && existing.type === FileType.Directory) {
    return {
      id: existing.id,
      name: existing.name,
      path: existing.path,
      type: FileType.Directory,
      workspaceType: existing.workspaceType,
      modifiedAt: existing.modifiedAt,
    };
  }

  const dirId = uuidv4();
  const dir: FileNode = {
    id: dirId,
    name: dirName,
    path: storedPath,
    type: FileType.Directory,
    workspaceType,
    workspaceId: workspaceId,
    modifiedAt: new Date().toISOString(),
    dirty: String(workspaceType) !== WorkspaceType.Browser,
    isSynced: false,
    syncStatus: SyncStatus.IDLE,
    version: 1,
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
    type: FileType.Directory,
    workspaceType,
    modifiedAt: dir.modifiedAt,
  };
}

export async function listFiles(dirPath: string = '', workspaceId?: string): Promise<FileMetadata[]> {
  const db = await getCacheDB();
  const normalizedPath = (dirPath === '/' || dirPath === '') ? '' : dirPath.replace(/\/$/, '').replace(/^\//, '');
  const pattern = normalizedPath ? `${normalizedPath}/` : '';
  const selector: any = workspaceId ? { workspaceId } : {};
  const allFiles = await findDocs((Collections as any).Files, { selector }) as any[];
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
    modifiedAt: file.modifiedAt,
  }));
}

export async function getAllFiles(workspaceId?: string): Promise<FileMetadata[]> {
  const db = await getCacheDB();
  const selector: any = workspaceId ? { workspaceId } : {};
  const allFiles = await findDocs((Collections as any).Files, { selector }) as any[];
  return allFiles.map(file => ({
    id: file.id,
    name: file.name,
    path: file.path,
    type: file.type,
    workspaceType: file.workspaceType,
    workspaceId: file.workspaceId,
    dirty: file.dirty,
    modifiedAt: file.modifiedAt,
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
  const sel: any = { type: FileType.Directory };
  if (workspaceId) sel.workspaceId = workspaceId;
  const existingDirs = await findDocs((Collections as any).Files, { selector: sel }) as any[];
  const existingPaths = new Set(existingDirs.map((d: any) => normalizePath(d.path || '')));
  const sample = allFiles.find(() => true);
  const wsType = sample ? (sample.workspaceType as WorkspaceType) : WorkspaceType.Browser;
  for (const folderPath of Array.from(folderSet)) {
    if (existingPaths.has(folderPath)) continue;
    const id = uuidv4();
    const name = folderPath.split('/').pop() || folderPath || 'untitled';
    const dir: FileNode = {
      id,
      name,
      path: folderPath,
      type: FileType.Directory,
      workspaceType: wsType,
      workspaceId: workspaceId,
      modifiedAt: new Date().toISOString(),
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
  const selector: any = { dirty: true };
  if (workspaceId) selector.workspaceId = workspaceId;
  const dirtyFiles = await findDocs((Collections as any).Files, { selector }) as any[];
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
  // Use rxdb-client API only
  const file = await getDoc((Collections as any).Files, fileId) as any;
  if (file) {
    await upsertCachedFile({ ...(file as any), dirty: false } as any);
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
  const files = await findDocs((Collections as any).Files, { selector: {} }) as any[];
  for (const f of files) {
    try { await removeDoc((Collections as any).Files, f.id); } catch (_) { }
  }
}

export async function switchWorkspaceType(newType: WorkspaceType): Promise<void> {
  // Use rxdb-client API only
  const allFiles = await findDocs((Collections as any).Files, { selector: {} }) as any[];
  for (const file of allFiles) {
    await upsertCachedFile({
      ...(file as any),
      workspaceType: newType,
      dirty: String(newType) !== WorkspaceType.Browser,
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
        // Use import.meta.env.BASE_URL to handle custom base paths in production
        let contentUrl: string;
        try {
          const baseUrl = import.meta.env.BASE_URL || '/';
          contentUrl = new URL(`content${sample.path}`, baseUrl).href;
        } catch (e) {
          // Fallback for test environments where URL constructor might fail
          contentUrl = `/content${sample.path}`;
        }
        const response = await fetch(contentUrl);
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
          modifiedAt: new Date().toISOString(),
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

// ==================== NEW UNIFIED FILENODE API ====================
// These methods implement the unified FileNode type across all layers
// (UI, stores, persistence, sync). They provide lazy-loaded content
// and efficient queries with RxDB indexes.

/**
 * Get a FileNode by ID (metadata only, no content)
 * @param id FileNode ID
 * @returns FileNode without content, or null if not found
 */
export async function getFileNode(id: string): Promise<FileNode | null> {
  await initializeRxDB();
  try {
    const doc = await getDoc((Collections as any).Files, id as any);
    if (!doc) return null;
    const { content, ...fileNode } = doc as any;
    return fileNode as FileNode;
  } catch (e) {
    console.warn('[file-manager] getFileNode failed for id=%s', id, e);
    return null;
  }
}

/**
 * Get a FileNode by ID with full content (lazy-load)
 * @param id FileNode ID
 * @returns FileNode with content, or null if not found
 */
export async function getFileNodeWithContent(id: string): Promise<FileNode | null> {
  await initializeRxDB();
  try {
    const doc = await getDoc((Collections as any).Files, id as any);
    return doc as FileNode | null;
  } catch (e) {
    console.warn('[file-manager] getFileNodeWithContent failed for id=%s', id, e);
    return null;
  }
}

/**
 * Save a FileNode (metadata + optional content) with atomic upsert
 * Handles conflict prevention via version increments
 * @param file FileNode to save
 * @returns Saved FileNode
 */
export async function saveFileNode(file: FileNode): Promise<FileNode> {
  await initializeRxDB();
  try {
    // Normalize path and ensure parent folders exist
    const norm = normalizePath(file.path);
    if (norm && file.type === FileType.File) {
      await ensureParentFoldersForPath(
        norm,
        file.workspaceType,
        file.workspaceId
      );
    }

    // Atomic upsert with version management
    const savedDoc = await atomicUpsert(
      (Collections as any).Files,
      file.id as any,
      (current?: any) => ({
        ...current,
        ...file,
        version: ((current?.version ?? 0) + 1),
        isSynced: current?.isSynced ?? false,
      })
    ) as any;

    return savedDoc as FileNode;
  } catch (e) {
    console.error('[file-manager] saveFileNode failed for id=%s path=%s', file.id, file.path, e);
    throw e;
  }
}

/**
 * Query files by path prefix (directory listing)
 * @param workspaceId Workspace ID
 * @param pathPrefix Path prefix to search (e.g., '/parent/')
 * @returns Array of FileNodes matching prefix
 */
export async function queryByPath(
  workspaceId: string,
  pathPrefix: string
): Promise<FileNode[]> {
  await initializeRxDB();
  try {
    const norm = normalizePath(pathPrefix);
    const selector: any = {
      workspaceId,
      path: { $regex: `^${norm}` },
    };
    const docs = await findDocs((Collections as any).Files, { selector }) as any[];
    return (docs || []).map(doc => {
      const { content, ...fileNode } = doc;
      return fileNode as FileNode;
    });
  } catch (e) {
    console.warn('[file-manager] queryByPath failed for prefix=%s workspaceId=%s', pathPrefix, workspaceId, e);
    return [];
  }
}

/**
 * Query files by name pattern (fuzzy search)
 * @param workspaceId Workspace ID
 * @param namePattern Name pattern to search
 * @returns Array of FileNodes matching pattern
 */
export async function queryByName(
  workspaceId: string,
  namePattern: string
): Promise<FileNode[]> {
  await initializeRxDB();
  try {
    const escapedPattern = namePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selector: any = {
      workspaceId,
      name: { $regex: escapedPattern },
    };
    const docs = await findDocs((Collections as any).Files, { selector }) as any[];
    return (docs || []).map(doc => {
      const { content, ...fileNode } = doc;
      return fileNode as FileNode;
    });
  } catch (e) {
    console.warn('[file-manager] queryByName failed for pattern=%s workspaceId=%s', namePattern, workspaceId, e);
    return [];
  }
}

/**
 * Query all dirty files in a workspace (for sync operations)
 * @param workspaceId Workspace ID
 * @returns Array of dirty FileNodes
 */
export async function queryDirtyFiles(workspaceId: string): Promise<FileNode[]> {
  await initializeRxDB();
  try {
    const selector = { workspaceId, dirty: true };
    const docs = await findDocs((Collections as any).Files, { selector }) as any[];
    return (docs || []).map(doc => {
      const { content, ...fileNode } = doc;
      return fileNode as FileNode;
    });
  } catch (e) {
    console.warn('[file-manager] queryDirtyFiles failed for workspaceId=%s', workspaceId, e);
    return [];
  }
}

/**
 * Build complete workspace file tree with nested children
 * This is the primary method for UI tree rendering
 * @param workspaceId Workspace ID
 * @returns Root FileNode with recursively built children
 */
export async function getWorkspaceTree(workspaceId: string): Promise<FileNode> {
  await initializeRxDB();
  try {
    const allFiles = await queryByPath(workspaceId, '');

    // Build map for fast lookup
    const fileMap = new Map<string, FileNode>();
    const rootIds: string[] = [];

    for (const file of allFiles) {
      fileMap.set(file.id, { ...file, children: [] });
      if (!file.parentId || file.parentId === '' || file.path === '') {
        rootIds.push(file.id);
      }
    }

    // Build hierarchy
    for (const file of allFiles) {
      if (file.parentId && fileMap.has(file.parentId)) {
        const parent = fileMap.get(file.parentId)!;
        if (!parent.children) parent.children = [];
        const child = fileMap.get(file.id);
        if (child) parent.children.push(child);
      }
    }

    // Return synthetic root or first root file
    const root: FileNode = {
      id: `${workspaceId}-root`,
      name: 'root',
      path: '',
      type: FileType.Directory,
      workspaceId,
      workspaceType: WorkspaceType.Browser, // Default, will be overridden by actual files
      dirty: false,
      isSynced: true,
      syncStatus: 'idle',
      version: 0,
      children: rootIds.map(id => fileMap.get(id)!).filter(Boolean),
    };

    return root;
  } catch (e) {
    console.error('[file-manager] getWorkspaceTree failed for workspaceId=%s', workspaceId, e);
    // Return synthetic root on error
    return {
      id: `${workspaceId}-root`,
      name: 'root',
      path: '',
      type: FileType.Directory,
      workspaceId,
      workspaceType: WorkspaceType.Browser,
      dirty: false,
      isSynced: false,
      syncStatus: 'error',
      version: 0,
      children: [],
    };
  }
}

/**
 * Delete a FileNode (cascade delete for directories)
 * @param id FileNode ID
 */
export async function deleteFileNode(id: string): Promise<void> {
  await initializeRxDB();
  try {
    // Get the file to check if it's a directory
    const file = await getFileNode(id);
    if (!file) return;

    // If directory, delete all children
    if (file.type === FileType.Directory && file.path) {
      const dirSelector: any = {
        workspaceId: file.workspaceId,
        path: { $regex: `^${file.path}(?:$|/)` },
      };
      const children = await findDocs((Collections as any).Files, { selector: dirSelector }) as any[];
      for (const child of children) {
        try {
          await removeDoc((Collections as any).Files, child.id);
        } catch (e) {
          console.warn('[file-manager] Failed to delete child', child.id, e);
        }
      }
    }

    // Delete the file itself
    await removeDoc((Collections as any).Files, id as any);
    console.info('[file-manager] Deleted fileNode id=%s', id);
  } catch (e) {
    console.error('[file-manager] deleteFileNode failed for id=%s', id, e);
    throw e;
  }
}

/**
 * Update sync status of a FileNode post-sync operation
 * @param id FileNode ID
 * @param status New sync status
 * @param version New version number
 * @returns Updated FileNode
 */
export async function updateSyncStatus(
  id: string,
  status: 'idle' | 'syncing' | 'conflict' | 'error',
  version: number
): Promise<FileNode> {
  await initializeRxDB();
  try {
    const updated = await atomicUpsert(
      (Collections as any).Files,
      id as any,
      (current?: any) => ({
        ...(current || {}),
        syncStatus: status,
        version,
        dirty: status === 'conflict' ? current?.dirty : false,
        isSynced: status === 'idle' || status === 'error' ? true : current?.isSynced,
      })
    ) as any;
    return updated as FileNode;
  } catch (e) {
    console.error('[file-manager] updateSyncStatus failed for id=%s', id, e);
    throw e;
  }
}

/**
 * Workspace-scoped subscription helper for the UI.
 * This returns an unsubscribe function.
 */
export function subscribeToWorkspaceFiles(workspaceId: string | null, callback: (files: FileMetadata[]) => void): () => void {
  const sub = observeCachedFiles((files: FileNode[]) => {
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


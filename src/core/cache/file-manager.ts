/**
 * File Manager - RxDB-backed file and directory operations
 *
 * Migrated from the legacy `file-operations.ts`. This module owns file CRUD,
 * folder helpers, watching/subscriptions and sample loading. It delegates
 * direct DB interactions to `rxdb.ts` helpers.
 */

import { v4 as uuidv4 } from 'uuid';
import type { FileDoc } from '@/core/rxdb/schemas';
import { SyncOp } from './types';
import { CachedFile, WorkspaceType, FileType } from './types';

import { initializeRxDB as clientInitializeRxDB, getCacheDB as clientGetCacheDB, upsertDoc as clientUpsertDoc, getDoc as clientGetDoc, findDocs as clientFindDocs, atomicUpsert as clientAtomicUpsert, removeDoc as clientRemoveDoc, subscribeQuery as clientSubscribeQuery } from '@/core/rxdb/rxdb-client';
import Collections from '@/core/rxdb/collections';
import { normalizePath } from '@/shared/utils/file-path-resolver';

// Local aliases for legacy names used throughout this module.
const atomicUpsert = clientAtomicUpsert;
const upsertDoc = clientUpsertDoc;
const getDoc = clientGetDoc;
const findDocs = clientFindDocs;
const subscribeQuery = clientSubscribeQuery;
const removeDoc = clientRemoveDoc;

// Re-export / delegate helpers expected by the rest of the codebase/tests.
export async function initializeRxDB(): Promise<void> { return clientInitializeRxDB(); }
export function getCacheDB(): any { return clientGetCacheDB(); }

export async function upsertCachedFile(doc: CachedFile): Promise<void> {
  await clientInitializeRxDB();
  try {
    console.debug('[file-manager] upsertCachedFile id=%s path=%s', doc.id, doc.path);
  } catch (_) { }
  return clientUpsertDoc((Collections as any).Files, doc as any);
}

export async function getCachedFile(pathOrId: string, workspaceId?: string): Promise<CachedFile | null> {
  // try by id first
  await clientInitializeRxDB();
  try {
    const byId = await clientGetDoc((Collections as any).Files, pathOrId as any);
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
      const found = await clientFindDocs((Collections as any).Files, { selector: sel });
      if (found && found.length) return (found[0] as any);
    } catch (_) { /* ignore individual candidate errors */ }
  }

  // Debug: list all IDs if nothing found (helps in failing tests)
  try {
    const all = await clientFindDocs((Collections as any).Files, { selector: {} });
    try { console.debug('[file-manager] getCachedFile allIds=', JSON.stringify((all || []).map((a: any) => a.id))); } catch (_) { }
  } catch (_) { }

  // Fallback: try a regex-match on path endings (handles leading-slash variants)
  try {
    const esc = (pathOrId || '').replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const regexSel: any = { path: { $regex: `${esc}$` } };
    if (workspaceId) regexSel.workspaceId = workspaceId;
    const regexFound = await clientFindDocs((Collections as any).Files, { selector: regexSel });
    if (regexFound && regexFound.length) return regexFound[0] as any;
  } catch (_) { /* ignore */ }

  return null;
}

export async function getAllCachedFiles(workspaceId?: string): Promise<CachedFile[]> {
  await clientInitializeRxDB();
  const selector = workspaceId ? { workspaceId } : {};
  return clientFindDocs((Collections as any).Files, { selector }) as Promise<CachedFile[]>;
}

export function observeCachedFiles(cb: (files: CachedFile[]) => void): { unsubscribe: () => void } {
  let unsubFn: (() => void) | null = null;
  (async () => {
    await clientInitializeRxDB();
    unsubFn = clientSubscribeQuery((Collections as any).Files, { selector: {} }, (docs: any[]) => cb(docs as CachedFile[]));
  })();
  return { unsubscribe: () => { try { if (unsubFn) unsubFn(); } catch (_) { } } };
}

export async function getDirtyCachedFiles(workspaceId?: string): Promise<CachedFile[]> {
  await clientInitializeRxDB();
  const selector: any = { dirty: true };
  if (workspaceId) selector.workspaceId = workspaceId;
  return clientFindDocs((Collections as any).Files, { selector }) as Promise<CachedFile[]>;
}

export async function markCachedFileAsSynced(fileId: string): Promise<void> {
  await clientInitializeRxDB();
  try {
    await clientAtomicUpsert((Collections as any).Files, fileId as any, (current?: any) => ({ ...(current || {}), id: fileId, dirty: false }));
  } catch (e) {
    const doc = await clientGetDoc((Collections as any).Files, fileId as any);
    if (doc) await clientUpsertDoc((Collections as any).Files, { ...(doc as any), dirty: false } as any);
  }
}

export async function removeCachedFile(fileId: string): Promise<void> {
  await clientInitializeRxDB();
  return clientRemoveDoc((Collections as any).Files, fileId as any);
}

export async function closeCacheDB(): Promise<void> {
  try {
    await clientInitializeRxDB();
    const files = await clientFindDocs((Collections as any).Files, { selector: {} });
    for (const f of files) {
      try { await clientRemoveDoc((Collections as any).Files, f.id); } catch (_) { }
    }
    const queue = await clientFindDocs((Collections as any).SyncQueue, { selector: {} });
    for (const q of queue) { try { await clientRemoveDoc((Collections as any).SyncQueue, q.id); } catch (_) { } }
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
  try { console.debug('[file-manager] loadFileSync cached=', JSON.stringify(cached)); } catch (_) { }
  if (cached) {
    // Prefer retrieving the canonical doc by id from rxdb-client
    const doc = (await getDoc<FileDoc>('files', cached.id)) || (cached as unknown as FileDoc);
    try { console.debug('[file-manager] loadFileSync doc=', JSON.stringify(doc)); } catch (_) { }
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
  try { console.debug('[file-manager] saveSyncFile saved=', JSON.stringify(saved)); } catch (_) { }
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
    lastModified: file.lastModified,
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
  const sel: any = { type: FileType.Dir };
  if (workspaceId) sel.workspaceId = workspaceId;
  const existingDirs = await findDocs((Collections as any).Files, { selector: sel }) as any[];
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


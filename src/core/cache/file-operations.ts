/**
 * RxDB File Operations - Single Source of Truth
 * 
 * This module provides all file operations (CRUD) backed by RxDB as the persistent cache layer.
 * All files are stored in RxDB's `cached_files` collection. CRDT/Yjs support
 * has been disabled; file content is stored directly on `cached_files.content`.
 *
 * Features:
 * - Unified interface for all workspace types (browser, local, gdrive, s3)
 * - Automatic dirty tracking for non-browser workspaces
 * - Observable file changes for reactive UI updates
 */

import { v4 as uuidv4 } from 'uuid';
import {
  initializeRxDB,
  getCacheDB,
  getCachedFile,
  upsertCachedFile,
  observeCachedFiles,
} from './index';
import { CachedFile, WorkspaceType, FileType } from './types';

// Store plain UTF-8 `content` on `cached_files` as the single source of truth.

/**
 * Convert workspace store type to cache WorkspaceType
 */
function toCacheWorkspaceType(wsType: WorkspaceType | string): WorkspaceType {
  // Accept either enum values or legacy string values
  if (wsType === 'drive' || wsType === 'gdrive') return 'gdrive' as WorkspaceType;
  if (typeof wsType === 'string') return wsType as WorkspaceType;
  return wsType as WorkspaceType;
}

/**
 * File data structure for operations
 */
export interface FileData {
  id: string;
  name: string;
  path: string;
  content: string;
  metadata?: Record<string, any>;
  mimeType?: string;
  lastModified?: number;
}

/**
 * File metadata structure
 */
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

/**
 * Initialize the file operations system
 * Must be called before any file operations
 */
export async function initializeFileOperations(): Promise<void> {
  console.log('[FileOperations] Initializing...');
  try {
    await initializeRxDB();
    console.log('[FileOperations] Initialized successfully');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[FileOperations] Initialization failed:', errorMsg);

    // Provide helpful error message for schema issues
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

/**
 * Load a file by path
 * Checks `cached_files` and returns stored `content`, or empty string for new files
 */
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
  
  // Try to find existing file
  const cached = await getCachedFile(path, workspaceId);
  
  if (cached) {
    // File exists, prefer stored `content` on the cached file record
    let content = cached.content || '';
    
    // Fallback: if content is empty (e.g., DB missing data),
    // try loading from the public `content/` folder so sample files still display.
    if ((!content || content.length === 0) && typeof window !== 'undefined') {
      try {
        const fetchPath = cached.path.startsWith('/') ? `/content${cached.path}` : `/content/${cached.path}`;
        const res = await fetch(fetchPath);
        if (res.ok) {
          const fetched = await res.text();
          if (fetched && fetched.length > 0) {
            content = fetched;
          }
        }
      } catch (err) {
        // ignore fetch errors and return whatever content we have
      }
    }

    return {
      id: cached.id,
      name: cached.name,
      path: cached.path,
      content,
      metadata: cached.metadata,
      lastModified: cached.lastModified,
    };
  }
  
  // File doesn't exist yet, return empty content
  return {
    id: uuidv4(),
    name: path.split('/').pop() || 'untitled',
    path,
    content: '',
    lastModified: Date.now(),
  };
}

/**
 * Save/update a file
 * Creates or updates entry in `cached_files` and stores content on the record
 * Marks as dirty for non-browser workspaces for later sync
 */
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
  
  // Get or create file ID
  let fileId: string;
  const existing = await getCachedFile(path, workspaceId);
  
  if (existing) {
    fileId = existing.id;
  } else {
    fileId = uuidv4();
  }
  
  // Upsert cached file with `content` stored directly
  const cachedFile: CachedFile = {
    id: fileId,
    name: path.split('/').pop() || 'untitled',
    path,
      type: FileType.File,
      workspaceType,
    workspaceId: workspaceId,
    content,
    metadata: metadata || { mimeType: 'text/markdown' },
    lastModified: Date.now(),
      dirty: String(workspaceType) !== WorkspaceType.Browser, // Mark dirty for sync-requiring workspaces
  };
  
  await upsertCachedFile(cachedFile);
  // NOTE: External I/O (File System Access API, adapter writes) is handled
  // centrally by SyncManager/adapters. `file-operations` is RxDB-only and
  // must not perform side-effect writes to the host filesystem.

  return {
    id: fileId,
    name: cachedFile.name,
    path,
    content,
    metadata: cachedFile.metadata,
    lastModified: cachedFile.lastModified,
  };
}

/**
 * Delete a file
 */
export async function deleteFile(path: string, workspaceId?: string): Promise<void> {
  const db = await getCacheDB();
  const cached = await getCachedFile(path, workspaceId);
  
  if (cached) {
    // Delete cached file by id
    await db.cached_files.findByIds([cached.id]).remove();
    // Attempt to delete from local filesystem if this is a local workspace
    // NOTE: Local filesystem deletes are handled by SyncManager/adapters.
    // `file-operations` will only update RxDB collections.
  }
}

/**
 * Rename a file
 */
export async function renameFile(oldPath: string, newPath: string, workspaceId?: string): Promise<void> {
  const cached = await getCachedFile(oldPath, workspaceId);
  
  if (!cached) {
    throw new Error(`File not found: ${oldPath}`);
  }
  
  const newName = newPath.split('/').pop() || 'untitled';
  
  // Update cached file with new path and name
  await upsertCachedFile({
    ...cached,
    path: newPath,
    name: newName,
    dirty: cached.dirty || String(cached.workspaceType) !== WorkspaceType.Browser,
  });
  // NOTE: Local filesystem rename is handled by SyncManager/adapters.
  // `file-operations` only updates RxDB metadata.
}

/**
 * Create a directory
 */
export async function createDirectory(
  path: string,
  workspaceType: WorkspaceType | 'browser' | 'local' | 'drive' | 'gdrive' | 's3' = WorkspaceType.Browser,
  workspaceId?: string
): Promise<FileMetadata> {
  const cacheType = toCacheWorkspaceType(workspaceType as any);
  return createDirectorySync(path, cacheType, workspaceId);
}

async function createDirectorySync(path: string, workspaceType: WorkspaceType = WorkspaceType.Browser, workspaceId?: string): Promise<FileMetadata> {
  const dirName = path.split('/').pop() || 'untitled';
  const dirId = uuidv4();
  
  const dir: CachedFile = {
    id: dirId,
    name: dirName,
    path,
    type: FileType.Dir,
    workspaceType,
    workspaceId: workspaceId,
    lastModified: Date.now(),
    dirty: String(workspaceType) !== WorkspaceType.Browser,
  };
  
  await upsertCachedFile(dir);
  // NOTE: Local filesystem directory creation is handled by SyncManager/adapters.
  // `file-operations` only updates RxDB collections.

  return {
    id: dirId,
    name: dirName,
    path,
    type: FileType.Dir,
    workspaceType,
    lastModified: dir.lastModified,
  };
}

/**
 * List files in a directory
 * Returns files and subdirectories at the given path
 */
export async function listFiles(dirPath: string = '', workspaceId?: string): Promise<FileMetadata[]> {
  const db = await getCacheDB();
  
  // Normalize path
  const normalizedPath = dirPath === '/' || dirPath === '' ? '' : dirPath.replace(/\/$/, '');
  
  // Query cached_files where path starts with dirPath
  const pattern = normalizedPath ? `${normalizedPath}/` : '';
  
  let allFilesQuery: any = db.cached_files.find();
  if (workspaceId) {
    allFilesQuery = allFilesQuery.where('workspaceId').eq(workspaceId);
  }
  const allFiles = await allFilesQuery.exec();
  
  // Filter files that are direct children of the directory
  const children = allFiles.filter(file => {
    if (!file.path.startsWith(pattern)) {
      return false;
    }
    
    const relativePath = file.path.slice(pattern.length);
    
    // Only return direct children (no nested paths with /)
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

/**
 * Get all files in the workspace
 */
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

/**
 * Get dirty files (files with unsaved changes to sync)
 * Only returns non-browser workspace files
 */
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

/**
 * Mark a file as synced (clear dirty flag)
 */
export async function markFileSynced(fileId: string): Promise<void> {
  const db = await getCacheDB();
  
  const file = await db.cached_files.findOne(fileId).exec();
  if (file) {
    await db.cached_files.upsert({
      ...file.toJSON(),
      dirty: false,
    });
  }
}

/**
 * Watch for changes to files in a directory (reactive updates)
 */
export function watchDirectory(dirPath: string = ''): any {
  return new Promise((resolve) => {
    const subscription = observeCachedFiles((files) => {
      // Filter files by directory if needed
      if (dirPath) {
        resolve(files.filter(f => f.path.startsWith(dirPath)));
      } else {
        resolve(files);
      }
    });
    return subscription;
  });
}

/**
 * Subscribe to file changes
 */
export function subscribeToFileChanges(callback: (files: FileMetadata[]) => void): () => void {
  const subscription = observeCachedFiles((files: any) => {
    callback(files as FileMetadata[]);
  });
  
  return () => subscription.unsubscribe();
}

/**
 * Clear all files from the cache (for workspace reset)
 */
export async function clearAllFiles(): Promise<void> {
  const db = await getCacheDB();
  
  await db.cached_files.find().remove();
  // CRDT docs removed; content stored on cached_files
}

/**
 * Switch workspace type (e.g., from browser to local)
 * Updates workspaceType for all files but keeps content
 */
export async function switchWorkspaceType(newType: WorkspaceType): Promise<void> {
  const db = await getCacheDB();
  
  const allFiles = await db.cached_files.find().exec();
  
  for (const file of allFiles) {
    const jsonFile = file.toJSON();
    await db.cached_files.upsert({
      ...jsonFile,
      workspaceType: newType,
      dirty: String(newType) !== WorkspaceType.Browser, // Mark dirty for non-browser workspaces
    });
  }
}

/**
 * Load sample files from public/content folder into RxDB
 * Used to populate the default "Verve Samples" workspace
 */
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

  console.log('[FileOperations] Loading sample files...');

  try {
    for (const sample of sampleFiles) {
      try {
        // Fetch file from public/content folder
        const response = await fetch(`/content${sample.path}`);
        if (!response.ok) {
          console.warn(`[FileOperations] Failed to load ${sample.path}: ${response.status}`);
          continue;
        }

        const content = await response.text();
        const fileId = `verve-samples-${sample.path}`;

        // Create file in cache with browser workspace type and store content
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

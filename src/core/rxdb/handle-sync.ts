import { upsertDoc, getDoc, initializeRxDB } from './rxdb-client';

// NOTE: We persist the actual `FileSystemDirectoryHandle` object into RxDB so
// the handle is stored via the underlying IndexedDB adapter (structured clone).
// This keeps a single source of truth in RxDB for both metadata and the handle.

export interface HandleMeta {
  id: string;
  workspaceId: string;
  directoryName: string;
  storedAt: number;
  permissionStatus: 'granted' | 'prompt' | 'denied' | string;
  notes?: string;
  directoryHandle?: any;
}

export async function storeHandleForWorkspace(workspaceId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  // Ensure the DB is initialized before attempting to persist handle metadata.
  // This makes the helper safe to call in tests and in code paths where the
  // RxDB instance may not have been eagerly created.
  try { await initializeRxDB(); } catch (_) { /* best-effort */ }
  const meta: any = {
    id: workspaceId,
    workspaceId,
    directoryName: handle?.name || 'unknown',
    storedAt: Date.now(),
    permissionStatus: 'granted',
    directoryHandle: handle
  };

  await upsertDoc('directory_handles_meta', meta as any);
}

export async function getHandleMeta(workspaceId: string): Promise<HandleMeta | null> {
  return await getDoc<HandleMeta>('directory_handles_meta', workspaceId);
}

export async function ensureHandleForWorkspace(workspaceId: string): Promise<FileSystemDirectoryHandle | null> {
  const doc: any = await getDoc<any>('directory_handles_meta', workspaceId);
  if (!doc) return null;
  return doc.directoryHandle || null;
}

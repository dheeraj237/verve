/**
 * Workspace Manager - workspace lifecycle and switching helpers
 *
 * This is a lightweight skeleton for workspace CRUD and switching logic.
 * The implementation will be expanded in follow-up PRs.
 */

import { initializeRxDB } from '@/core/rxdb/rxdb-client';
import { WorkspaceType } from './types';
import { loadSamplesIntoWorkspace } from '@/core/cache/sample-loader';
import { saveFile } from '@/core/cache/file-manager';
import { storeHandleForWorkspace, getHandleMeta, ensureHandleForWorkspace } from '@/core/rxdb/handle-sync';
import { findDocs, removeDoc } from '@/core/rxdb/rxdb-client';

export interface WorkspaceRecord {
  id: string;
  name: string;
  type: WorkspaceType;
  createdAt: string;
  lastAccessed: string;
}

export async function createWorkspace(name: string, type: WorkspaceType, id?: string): Promise<WorkspaceRecord> {
  const workspaceId = id || generateWorkspaceId(type);
  const workspace: WorkspaceRecord = {
    id: workspaceId,
    name,
    type,
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
  };

  // Only create a default `verve.md` for browser workspaces (skip samples and non-browser types)
  if (type === WorkspaceType.Browser && workspaceId !== 'verve-samples') {
    try {
      await initializeRxDB();
    } catch (e) {
      // best-effort
    }
    try {
      await saveFile('verve.md', '# Verve 🚀', type, undefined, workspaceId);
    } catch (err) {
      console.warn('Failed to create default verve.md for workspace', workspaceId, err);
    }
  }

  return workspace;
}

/**
 * Generate a reasonably-unique workspace id for the given type.
 * Exported so other modules (or tests) can reuse an identical strategy.
 */
export function generateWorkspaceId(type: WorkspaceType) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  // Persistence is handled by useWorkspaceStore; return empty by default.
  return [];
}

export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  return null;
}

export async function deleteWorkspace(id: string): Promise<void> {
  // Deletion of workspace metadata and clearing related files is handled
  // by the store and file-manager.
}

export async function switchWorkspace(id: string): Promise<void> {
  // Ensure RxDB is initialized during workspace switch
  try {
    await initializeRxDB();
  } catch (e) {
    // ignore init errors; caller will handle user-facing flow
  }
}

export async function createSampleWorkspaceIfMissing(): Promise<WorkspaceRecord> {
  // Create a deterministic 'verve-samples' workspace and populate it with sample files
  const workspaceId = 'verve-samples';
  const workspace: WorkspaceRecord = {
    id: workspaceId,
    name: 'Verve Samples',
    type: WorkspaceType.Browser,
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
  };

  try {
    await initializeRxDB();
    await loadSamplesIntoWorkspace(workspaceId);
  } catch (e) {
    console.warn('Failed to create sample workspace:', e);
  }

  return workspace;
}

/**
 * Persist a directory handle for the given workspace and upsert RxDB metadata
 */
export async function storeDirectoryHandle(workspaceId: string, directoryHandle: FileSystemDirectoryHandle): Promise<void> {
  try {
    await storeHandleForWorkspace(workspaceId, directoryHandle);
  } catch (err) {
    console.warn('Failed to upsert handle metadata for workspace', workspaceId, err);
  }
}

/**
 * Restore a persisted directory handle (if any) and ensure RxDB metadata is present.
 */
export async function restoreDirectoryHandle(workspaceId: string): Promise<FileSystemDirectoryHandle | null> {
  const handle = await ensureHandleForWorkspace(workspaceId);
  return handle;
}

export async function listPersistedHandles() {
  return await findDocs<any>('directory_handles_meta', { selector: {} });
}

/**
 * Remove persisted directory handle for workspace and delete RxDB metadata
 */
export async function removeDirectoryHandle(workspaceId: string): Promise<void> {
  try {
    await removeDoc('directory_handles_meta', workspaceId);
  } catch (err) {
    console.warn('Failed to remove handle metadata for', workspaceId, err);
  }
}

/**
 * Request permission for a workspace handle (must be called from a user gesture).
 * Uses the `directory_handles_meta` RxDB doc to obtain the persisted `directoryHandle`.
 * If permission granted, upsert RxDB metadata and return the handle.
 */
export async function requestPermissionForWorkspace(workspaceId: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    // Read stored handle from RxDB and request permission from it (must be user gesture)
    const meta = await getHandleMeta(workspaceId);
    const handle = (meta as any)?.directoryHandle as FileSystemDirectoryHandle | undefined | null;
    if (!handle) return null;
    try {
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission === 'granted') return handle;
      const newPermission = await handle.requestPermission({ mode: 'readwrite' });
      if (newPermission === 'granted') {
        try { await storeHandleForWorkspace(workspaceId, handle); } catch (_) { }
        return handle;
      }
      return null;
    } catch (err) {
      console.warn('Permission request failed for handle:', err);
      return null;
    }
  } catch (err) {
    console.warn('requestPermissionForWorkspace failed:', err);
    return null;
  }
}

/**
 * Request permission for a local workspace handle (must be called from a user gesture).
 * This internally uses SyncManager to request permission via File System Access API.
 */
export async function requestPermissionForLocalWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const sm = await import('@/core/sync/sync-manager');
    const ok = await sm.getSyncManager().requestPermissionForLocalWorkspace(workspaceId);
    return !!ok;
  } catch (err) {
    console.warn('requestPermissionForLocalWorkspace failed:', err);
    return false;
  }
}

/**
 * Open a local directory using File System Access API.
 * This internally uses SyncManager to show the directory picker and scan files.
 */
export async function openLocalDirectory(workspaceId?: string): Promise<boolean> {
  try {
    const sm = await import('@/core/sync/sync-manager');
    await sm.getSyncManager().requestOpenLocalDirectory(workspaceId);
    return true;
  } catch (err) {
    console.warn('openLocalDirectory failed:', err);
    return false;
  }
}

/**
 * Check if a local directory is currently open/ready
 */
export async function hasLocalDirectory(): Promise<boolean> {
  try {
    const sm = await import('@/core/sync/sync-manager');
    const adapter = sm.getSyncManager().getAdapter('local');
    if (!adapter) return false;
    return typeof (adapter as any).isReady === 'function' ? (adapter as any).isReady() : false;
  } catch (e) {
    return false;
  }
}

/**
 * Clear the currently open local directory and dispose the adapter
 */
export async function clearLocalDirectory(): Promise<void> {
  try {
    const sm = await import('@/core/sync/sync-manager');
    const adapter = sm.getSyncManager().getAdapter('local');
    if (adapter && typeof (adapter as any).dispose === 'function') {
      await (adapter as any).dispose().catch(() => { });
    }
  } catch (e) {
    // ignore
  }
}

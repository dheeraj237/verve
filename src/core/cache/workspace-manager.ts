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

  // Create a default `verve.md` for all non-local workspace types (browser, gdrive, s3, etc.)
  // Skip for the special sample workspace and local workspaces (those come with their own files)
  if (type !== WorkspaceType.Local && workspaceId !== 'verve-samples') {
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



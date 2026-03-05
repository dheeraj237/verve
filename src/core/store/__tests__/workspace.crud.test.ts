import { vi, beforeEach, describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType } from '@/core/cache/types';
import * as fileOps from '@/core/cache/file-manager';

// Use the real rxdb-client for this integration test to capture real DB traces
vi.unmock('@/core/rxdb/rxdb-client');

describe('workspace CRUD integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates, lists, reads and deletes a workspace', async () => {

    await fileOps.initializeFileOperations();

    // Start clean
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });

    // Create a new workspace via public API
    useWorkspaceStore.getState().createWorkspace('My Workspace', WorkspaceType.Browser, { id: 'my-ws' });

    // Workspace should be in the store and active
    const store = useWorkspaceStore.getState();
    expect(store.workspaces.some((w: any) => w.id === 'my-ws')).toBeTruthy();
    expect(store.activeWorkspaceId).toBe('my-ws');

    // The default verve.md is created asynchronously; wait via RxDB subscription
    const { observeCachedFiles } = await import('@/core/cache');
    await new Promise<void>((resolve) => {
      const sub: any = observeCachedFiles((files: any[]) => {
        const f = files.find((x) => (x.path || '').endsWith('verve.md') && x.workspaceId === 'my-ws');
        if (f && f.content && f.content.length > 0) {
          try { sub.unsubscribe(); } catch (_) { }
          resolve();
        }
      });
      // fallback timeout
      setTimeout(() => { try { sub.unsubscribe(); } catch (_) { }; resolve(); }, 2000);
    });

    const loaded = await fileOps.loadFile('verve.md', 'browser', 'my-ws');
    expect(loaded).toBeDefined();
    expect(loaded.content).toBe('# Verve 🚀');

    // List workspaces via store helpers
    const browserWS = useWorkspaceStore.getState().getBrowserWorkspaces();
    expect(browserWS.some((w: any) => w.id === 'my-ws')).toBeTruthy();

    // Delete the workspace and verify removal
    useWorkspaceStore.getState().deleteWorkspace('my-ws');
    const after = useWorkspaceStore.getState();
    expect(after.workspaces.some((w: any) => w.id === 'my-ws')).toBeFalsy();
    // activeWorkspaceId should be null or another workspace id
    expect(after.activeWorkspaceId === null || typeof after.activeWorkspaceId === 'string').toBeTruthy();
  });
});

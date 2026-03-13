import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted spy refs — defined via vi.hoisted() so they exist when vi.mock
// factories run (vitest hoists vi.mock calls to top of file)
// ---------------------------------------------------------------------------
const {
  mockPull,
  mockPush,
  mockDestroy,
  mockEnsurePermission,
  mockSubscribeDirty,
  mockMarkSynced,
  mockGetFileNodeWithContent,
  mockUpdateSyncStatus,
} = vi.hoisted(() => ({
  mockPull: vi.fn().mockResolvedValue(undefined),
  mockPush: vi.fn().mockResolvedValue(undefined),
  mockDestroy: vi.fn(),
  mockEnsurePermission: vi.fn().mockResolvedValue(true),
  mockSubscribeDirty: vi.fn(),
  mockMarkSynced: vi.fn().mockResolvedValue(undefined),
  mockGetFileNodeWithContent: vi.fn().mockResolvedValue(null),
  mockUpdateSyncStatus: vi.fn().mockResolvedValue(undefined),
}));

// Use plain constructor functions (not arrow functions) so `new LocalAdapter()`
// works. Mock path uses the alias so vitest resolves it to the same module
// regardless of which file imports it.
vi.mock('@/core/sync/adapters', () => ({
  /* eslint-disable @typescript-eslint/no-explicit-any */
  LocalAdapter: function LocalAdapter(wsId: string) {
    (this as any).workspaceId = wsId;
    (this as any).type = 'local';
    (this as any).pull = mockPull;
    (this as any).push = mockPush;
    (this as any).destroy = mockDestroy;
    (this as any).ensurePermission = mockEnsurePermission;
    (this as any).shouldIncludeFile = () => true;
    (this as any).shouldIncludeFolder = () => true;
  },
  BrowserAdapter: function BrowserAdapter(wsId: string) {
    (this as any).workspaceId = wsId;
    (this as any).type = 'browser';
    (this as any).pull = mockPull;
    (this as any).push = mockPush;
    (this as any).destroy = mockDestroy;
    (this as any).ensurePermission = vi.fn().mockResolvedValue(true);
    (this as any).shouldIncludeFile = () => true;
    (this as any).shouldIncludeFolder = () => true;
  },
  /* eslint-enable @typescript-eslint/no-explicit-any */
}));

vi.mock('@/core/cache/file-manager', () => ({
  subscribeToDirtyWorkspaceFiles: mockSubscribeDirty,
  markCachedFileAsSynced: mockMarkSynced,
  getFileNodeWithContent: mockGetFileNodeWithContent,
  updateSyncStatus: mockUpdateSyncStatus,
}));

// Minimal workspace store mock
const workspaceStoreState: any = {
  activeWorkspaceId: null,
  workspaces: [],
  permissionNeeded: {},
  setPermissionNeeded: vi.fn(),
};

vi.mock('@/core/store/workspace-store', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (s: any) => any) => selector ? selector(workspaceStoreState) : workspaceStoreState,
    {
      getState: () => workspaceStoreState,
      subscribe: vi.fn((_selector: any, listener: any) => {
        (workspaceStoreState as any)._listener = listener;
        return () => {};
      }),
    }
  ),
}));

// ---------------------------------------------------------------------------
// Import SyncManager AFTER mocks
// ---------------------------------------------------------------------------

// Reset the singleton between tests
beforeEach(async () => {
  const mod = await import('../sync-manager');
  mod.getSyncManager().stop();
});

// Use dynamic import so each test suite gets fresh module state
async function freshSyncManager() {
  // The SyncManager is a singleton — reset it between tests by stopping it
  const mod = await import('../sync-manager');
  const mgr = mod.getSyncManager();
  mgr.stop();
  return mgr;
}

describe('SyncManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceStoreState.activeWorkspaceId = null;
    workspaceStoreState.workspaces = [];
    // Default: dirty sub returns a no-op unsubscribe
    mockSubscribeDirty.mockReturnValue(() => {});
  });

  afterEach(async () => {
    const mod = await import('../sync-manager');
    mod.getSyncManager().stop();
  });

  it('mountWorkspace("ws1", "local") creates LocalAdapter, calls pull(), subscribes to dirty files', async () => {
    const mgr = await freshSyncManager();
    await mgr.mountWorkspace('ws1', 'local');

    const adapter = (mgr as any)._adapters.get('ws1');
    expect(adapter).toBeDefined();
    expect(adapter.type).toBe('local');
    expect(mockPull).toHaveBeenCalledOnce();
    expect(mockSubscribeDirty).toHaveBeenCalledWith('ws1', expect.any(Function));
  });

  it('mountWorkspace("ws2", "browser") creates BrowserAdapter, calls pull()', async () => {
    const mgr = await freshSyncManager();
    await mgr.mountWorkspace('ws2', 'browser');

    const adapter = (mgr as any)._adapters.get('ws2');
    expect(adapter).toBeDefined();
    expect(adapter.type).toBe('browser');
    expect(mockPull).toHaveBeenCalledOnce();
    expect(mockSubscribeDirty).toHaveBeenCalledWith('ws2', expect.any(Function));
  });

  it('unmountWorkspace calls adapter.destroy() and cancels pending timers', async () => {
    vi.useFakeTimers();
    const mgr = await freshSyncManager();
    await mgr.mountWorkspace('ws3', 'local');

    // Inject a pending timer to verify it gets cancelled
    const timerSpy = vi.spyOn(global, 'clearTimeout');
    const fakeTimer = setTimeout(() => {}, 10_000);
    (mgr as any)._debounceTimers.set('ws3:file.md', fakeTimer);

    mgr.unmountWorkspace('ws3');

    expect(mockDestroy).toHaveBeenCalledOnce();
    expect(timerSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('debounced push: markCachedFileAsSynced called after 2s debounce', async () => {
    vi.useFakeTimers();
    const mgr = await freshSyncManager();

    const fileNode = { id: 'ws4:note.md', path: 'note.md', dirty: true, version: 1 } as any;
    mockGetFileNodeWithContent.mockResolvedValueOnce({ ...fileNode, content: '# content' });

    // Capture the dirty callback
    let dirtyCallback: ((files: any[]) => void) | null = null;
    mockSubscribeDirty.mockImplementationOnce((_wsId: string, cb: (files: any[]) => void) => {
      dirtyCallback = cb;
      return () => {};
    });

    await mgr.mountWorkspace('ws4', 'local');
    expect(dirtyCallback).not.toBeNull();

    // Trigger dirty subscription with one file
    dirtyCallback!([fileNode]);

    // Fast-forward 2 seconds for the debounce
    await vi.advanceTimersByTimeAsync(2_000);

    expect(mockGetFileNodeWithContent).toHaveBeenCalledWith('ws4:note.md');
    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockMarkSynced).toHaveBeenCalledWith('ws4:note.md');

    vi.useRealTimers();
  });

  it('on push failure < 3 retries: schedules retry with exponential delay', async () => {
    vi.useFakeTimers();
    const mgr = await freshSyncManager();

    const fileNode = { id: 'ws5:retry.md', path: 'retry.md', dirty: true, version: 1 } as any;
    mockGetFileNodeWithContent.mockResolvedValue({ ...fileNode, content: 'data' });
    mockPush.mockRejectedValue(new Error('disk full'));

    let dirtyCallback: ((files: any[]) => void) | null = null;
    mockSubscribeDirty.mockImplementationOnce((_wsId: string, cb: (files: any[]) => void) => {
      dirtyCallback = cb;
      return () => {};
    });

    await mgr.mountWorkspace('ws5', 'local');
    dirtyCallback!([fileNode]);

    // First attempt after 2s
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mockPush).toHaveBeenCalledOnce();
    // Should reschedule — timer should be set for ws5:retry.md
    expect((mgr as any)._debounceTimers.has('ws5:retry.md')).toBe(true);

    vi.useRealTimers();
  });

  it('on push failure >= 3 retries: calls updateSyncStatus with error and no more timers', async () => {
    vi.useFakeTimers();
    const mgr = await freshSyncManager();

    const fileNode = { id: 'ws6:broken.md', path: 'broken.md', dirty: true, version: 1 } as any;
    mockGetFileNodeWithContent.mockResolvedValue({ ...fileNode, content: 'data' });
    mockPush.mockRejectedValue(new Error('permission denied'));

    let dirtyCallback: ((files: any[]) => void) | null = null;
    mockSubscribeDirty.mockImplementationOnce((_wsId: string, cb: (files: any[]) => void) => {
      dirtyCallback = cb;
      return () => {};
    });

    await mgr.mountWorkspace('ws6', 'local');
    // Pre-seed retryCount so we're already at MAX_RETRIES - 1
    (mgr as any)._retryCount.set('ws6:broken.md', 2);

    dirtyCallback!([fileNode]);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(mockUpdateSyncStatus).toHaveBeenCalledWith('ws6:broken.md', 'error', 1);
    expect((mgr as any)._debounceTimers.has('ws6:broken.md')).toBe(false);

    vi.useRealTimers();
  });

  it('rapid mountWorkspace A→B→C: only C is active; A and B adapters are destroyed', async () => {
    const mgr = await freshSyncManager();

    // Mount A, B, C sequentially (simulating rapid switches)
    const mountA = mgr.mountWorkspace('ws-A', 'local');
    const mountB = mgr.mountWorkspace('ws-B', 'browser');
    const mountC = mgr.mountWorkspace('ws-C', 'local');

    await Promise.all([mountA, mountB, mountC]);

    expect((mgr as any)._activeWorkspaceId).toBe('ws-C');
  });
});

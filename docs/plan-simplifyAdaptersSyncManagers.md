# Plan: Simplify Adapter + SyncManager Architecture (Production-Ready v2)

## Grilling: 12 Bugs / Gaps Found in the Original Plan

**1. FileSystemHandle in Dexie — RISKY**
Dexie 3+ uses IndexedDB's structured clone algorithm for `put()` calls, so handles *technically* survive. HOWEVER: Dexie has an internal document pipeline that may attempt JSON normalization for replication/sync plugins, and its schema-migration pass can silently corrupt structured-clone objects. The safest zero-risk approach is a **dedicated vanilla IndexedDB** database (`verve-handles`) with a single object store. No schema, no migrations, no Dexie internals — just `IDBObjectStore.put(handle, workspaceId)`. This also keeps handle storage completely isolated from the app's RxDB/Dexie databases (no accidental schema migration wipes it). The current `handle-sync.ts` comment ("handles lose their methods") is wrong — that was a bug in Chromium 84 that was fixed in Chrome 86. Since Chrome 86+ (March 2021), handles correctly survive structured clone in IndexedDB and keep all their methods.

**2. `showDirectoryPicker` defaults to READ, not readwrite**
`window.showDirectoryPicker()` with no options requested `read` mode in the original spec. Chrome shipped it as `readwrite` by default, but the spec and Firefox use `read`. The plan must explicitly pass `{ mode: 'readwrite' }` to ensure push works after initial pick. During `ensureHandle('read')` the adapter can use `queryPermission({ mode: 'read' })` first (no dialog), then escalate to `requestPermission({ mode: 'readwrite' })` only when pushing.

**3. `requestPermission()` requires a user gesture — race condition on workspace switch**
`handle.requestPermission()` throws `SecurityError` if called outside a browser user gesture. The plan proposes `ensureHandle` calling it deep in an async chain from `switchWorkspace`. Chrome preserves user activation through the **first** `await` in a chain but loses it after. If `switchWorkspace` has several awaits before `pull()` calls `ensureHandle`, the permission dialog will fail silently. Fix: the `mountWorkspace(id, type)` call in `switchWorkspace` must be the **first async operation**, before any non-permission awaits (`saveTabsForWorkspace`, etc.). OR: separate the concern — if permission is required, surface a `permissionNeeded` flag in the workspace store, and the UI renders a "Grant Access" button that calls `adapter.ensurePermission()` on click (guaranteed user gesture).

**4. `push(fileId, content)` — fileId ≠ path for filesystem writes**
`LocalAdapter.push` needs the **file path** (relative to the root directory handle) to navigate the directory tree, not just an opaque ID. IDs in RxDB may be path-based (common in this codebase), but this should be explicit. New signature: `push(path: string, content: string): Promise<void>`. Before the push, the SyncManager loads the `FileNode` from RxDB by ID, gets its `.path`, then calls `adapter.push(fileNode.path, content)`.

**5. Concurrent workspace switches leave stale pull writes in RxDB**
If a user switches workspace A → B → C quickly, the pull for A or B may still be running when C is active. When A's `pull()` finishes, it upserts A's files into RxDB — but the active workspace is now C. Fix: pass `AbortSignal` into `pull()`, or check a "fence" in LocalAdapter: before each `upsertCachedFile` call inside the directory walker, verify the adapter's `workspaceId` is still the SyncManager's `_activeWorkspaceId`.

**6. Filter interface missing from `IAdapter` — plan mentions it but never defines it**
The filter must be part of the interface so every adapter can have its own implementation. Two methods needed:
- `shouldIncludeFile(path: string, name: string, sizeBytes: number): boolean`
- `shouldIncludeFolder(name: string): boolean`

LocalAdapter loads `workspace-ignore.json`. BrowserAdapter always returns `true`. Future GDrive adapter can add its own rules.

**7. `pull()` returns `void` but file explorer needs a "pull done" signal**
The file explorer listens to reactive RxDB queries (via `rxdb-client`), so it auto-updates when `upsertCachedFile` writes. This is fine. BUT `isWorkspaceSwitching` in the store must stay `true` until `pull()` resolves — the plan doesn't thread this state through `mountWorkspace`. Fix: `switchWorkspace` awaits `getSyncManager().mountWorkspace(id, type)` before setting `isWorkspaceSwitching: false`.

**8. Dirty files from `pull()` must never be `dirty: true`**
The existing integration test "should not mark files as dirty when loading a local directory" covers this. `upsertCachedFile` in LocalAdapter's pull must always pass `dirty: false, isSynced: true`. This must be enforced in the adapter, not left to the caller.

**9. No retry on push failure — file stays dirty forever**
If `push()` throws (write permission revoked, disk full, etc.), the file stays dirty. The SyncManager needs a simple per-file retry: max 3 attempts with exponential backoff. After 3 failures, emit a `push-failed` event and mark the file with a `syncError` field in RxDB. No complex queue needed — just `retryCount: Map<fileId, number>` in SyncManager.

**10. `destroy()` must cancel in-flight pull — no cleanup on adapter switch**
If `unmountWorkspace` is called while a `pull()` is in progress for that adapter, the in-flight `upsertCachedFile` calls will still run, writing stale data. Fix: `LocalAdapter` needs a boolean `_destroyed` flag; the directory walker checks it before each upsert and short-circuits.

**11. Test scope is massive — 23 dead tests in `__tests__/`, 7 in `tests/integration/`**
Every test file in `src/core/sync/__tests__/` imports dead symbols: `ISyncAdapter`, `registerAdapter`, `pullWorkspace`, `requestOpenLocalDirectory`, `FileSyncQueue`, etc. These must all be deleted and replaced with tests against the new surface area. The 7 integration tests in `tests/integration/` that reference `getSyncManager().stop()`, `registerAdapter`, etc. must also be updated.

**12. `resolveJsonModule: true` is already set in `tsconfig.json`**
The `workspace-ignore.json` static config import will work without any tsconfig changes. ✓

---

## Implementation Plan

**TL;DR** — Full rewrite of `src/core/sync/` to 3 simple classes (`LocalAdapter`, `BrowserAdapter`, `SyncManager`) implementing one lean `IAdapter` interface with a built-in filter contract. Directory handles stored in a dedicated vanilla IndexedDB store (`verve-handles`). SyncManager listens to workspace changes and debounce-pushes dirty files. All 23 legacy tests deleted and replaced.

---

### Phase 1 — Foundation (no inter-file dependencies)

**1. Create `src/core/sync/adapter.ts`** — the single interface + filter contract:
```ts
interface FileFilter {
  ignoreNames: string[]
  ignoreExtensions: string[]
  ignoreFolders: string[]
  maxFileSizeMB: number
}

interface IAdapter {
  readonly workspaceId: string
  readonly type: 'local' | 'browser'
  pull(signal?: AbortSignal): Promise<void>          // source → RxDB, always dirty:false
  push(path: string, content: string): Promise<void> // RxDB → source
  ensurePermission(): Promise<boolean>               // call during user gesture if needed
  shouldIncludeFile(path: string, name: string, sizeBytes: number): boolean
  shouldIncludeFolder(name: string): boolean
  destroy(): void
}
```

**2. Create `src/core/sync/workspace-ignore.json`** — static config:
- `ignoreNames`: `.DS_Store`, `Thumbs.db`, `.localized`, `.gitkeep`
- `ignoreExtensions`: `.exe`, `.dll`, `.class`, `.jar`, `.zip`, `.tar`, `.gz`, `.bin`, `.dylib`, `.so`, `.o`, `.obj`, `.pyc`
- `ignoreFolders`: `.git`, `.hg`, `.svn`, `node_modules`, `__pycache__`, `.venv`, `.venv3`, `.cache`, `dist`, `build`, `.next`, `.nuxt`, `.output`, `vendor`
- `maxFileSizeMB`: 5

**3. Create `src/core/sync/handle-store.ts`** — vanilla IndexedDB, zero dependencies:
- Opens `verve-handles` DB, object store `handles`, no keyPath (key passed explicitly)
- API: `getHandle(workspaceId): Promise<FileSystemDirectoryHandle | null>`, `setHandle(workspaceId, handle): Promise<void>`, `removeHandle(workspaceId): Promise<void>`
- Uses raw `indexedDB.open()` — no Dexie, no RxDB
- Stores handle using `objectStore.put(handle, workspaceId)` → structured clone path preserves all handle methods
- All methods return `null`/noop gracefully in non-browser environments (SSR safety)

---

### Phase 2 — Adapter Implementations (*depends on Phase 1*)

**4. Rewrite `src/core/sync/adapters/local-adapter.ts`** — simple class, `implements IAdapter`:
- Constructor: `new LocalAdapter(workspaceId: string)` — immediately usable, no static factory
- `_dirHandle: FileSystemDirectoryHandle | null` — in-memory, set by `ensureHandle()`
- `_destroyed = false` — checked before each upsert in `pull()` to short-circuit stale writes
- `pull(signal?)`:
  1. `const handle = await this.ensureHandle('read')` (throws `PermissionError` if unavailable)
  2. Walk directory tree recursively; check `signal?.aborted` at top of each level
  3. For each file entry: `shouldIncludeFolder(name)` gate on dirs; `shouldIncludeFile(path, name, sizeBytes)` gate on files
  4. Read content via `fileHandle.getFile().text()`
  5. `if (!this._destroyed) await upsertCachedFile({ ..., dirty: false, isSynced: true })`
- `push(path, content)`:
  1. `const handle = await this.ensureHandle('readwrite')`
  2. Navigate path segments using `handle.getDirectoryHandle(part, { create: true })`
  3. Get file handle + `createWritable()` + `write(content)` + `close()`
- `ensurePermission(): Promise<boolean>` — **public, for UI "Grant Access" button**:
  1. Try `_dirHandle?.queryPermission({ mode: 'readwrite' })` → if 'granted' return true
  2. Try `_dirHandle?.requestPermission({ mode: 'readwrite' })` → native dialog
  3. If no handle: `showDirectoryPicker({ mode: 'readwrite' })` → `HandleStore.setHandle()` → cache in `_dirHandle` → return true
- `ensureHandle(mode)` (private):
  1. Check in-memory `_dirHandle` + `queryPermission(mode)` → if 'granted' return it
  2. `HandleStore.getHandle(workspaceId)` → validate → `queryPermission(mode)` → if 'granted' cache + return
  3. If 'prompt': attempt `requestPermission(mode)` → if 'granted' cache + return
  4. Throw `PermissionError` (SyncManager catches and sets `permissionNeeded: true` on workspace)
- `shouldIncludeFile` / `shouldIncludeFolder` — loaded from `workspace-ignore.json` at module load
- `destroy()`: `_destroyed = true`, `_dirHandle = null`

**5. Rewrite `src/core/sync/adapters/browser-adapter.ts`** — no-op, `implements IAdapter`:
- `pull()` → `Promise.resolve()` (RxDB is source of truth)
- `push()` → `Promise.resolve()`
- `ensurePermission()` → `Promise.resolve(true)`
- `shouldIncludeFile()` → `true`; `shouldIncludeFolder()` → `true`
- `destroy()` → no-op

**6. Update `src/core/sync/adapters/index.ts`** — export `LocalAdapter`, `BrowserAdapter`, re-export `IAdapter`

---

### Phase 3 — SyncManager Rewrite (*depends on Phase 2*)

**7. Rewrite `src/core/sync/sync-manager.ts`** — ~150 lines, no RxJS, no registry:
```
adapters:          Map<workspaceId, IAdapter>
_activeWorkspaceId: string | null
_debounceTimers:   Map<fileId, ReturnType<typeof setTimeout>>
_retryCount:       Map<fileId, number>  // max 3
_dirtySub:         (() => void) | null
_workspaceSub:     (() => void) | null
```
- `start()`: subscribe to `useWorkspaceStore` `activeWorkspaceId` changes; on change call `mountWorkspace(newId, workspace.type)` (replaces active)
- `mountWorkspace(id, type): Promise<void>`:
  1. Destroy existing adapter for `id` if any
  2. Create `new LocalAdapter(id)` or `new BrowserAdapter(id)` based on `type`
  3. Store in `adapters` map; set `_activeWorkspaceId = id`
  4. `await adapter.pull()` (full reload into RxDB, always `dirty:false`)
  5. Tear down old `_dirtySub`, set up new `subscribeToDirtyWorkspaceFiles(id, ...)` subscription
- `unmountWorkspace(id)`: call `adapter.destroy()`, remove from map, cancel pending debounce timers for its files
- Dirty subscription handler (internal `_onDirtyFile(fileNode)`):
  1. Cancel existing debounce timer for `fileNode.id`
  2. Set 2s debounce:
     - `getFileNodeWithContent(fileNode.id, workspaceId)` → get path + content
     - `activeAdapter.push(fileNode.path, content)`
     - On success: `markCachedFileAsSynced(fileNode.id)`; delete from `_retryCount`
     - On failure: increment `_retryCount.get(fileId)`. If < 3: reschedule debounce (exponential: 2s→5s→10s). If ≥ 3: `updateSyncStatus(fileId, 'error')`; delete timer
- `stop()`: unsubscribe all, destroy all adapters, clear all timers
- **No** `registerAdapter()`, `pullWorkspace()`, `requestOpenLocalDirectory()`, `initializeForWorkspace()`, `cleanupForWorkspace()`

**8. Update `src/core/sync/index.ts`** — clean exports: `SyncManager`, `getSyncManager`, `stopSyncManager`, `LocalAdapter`, `BrowserAdapter`, `IAdapter`

---

### Phase 4 — Workspace Store + Init Hook (*depends on Phase 3*)

**9. Update `src/core/store/workspace-store.ts`**:
- `createWorkspace`: for `local` type, after store update trigger `getSyncManager().mountWorkspace(id, type)` — this must be the first async dispatch (user gesture preservation)
- `switchWorkspace`:
  1. `set({ isWorkspaceSwitching: true })`
  2. `saveTabsForWorkspace(oldId)` (sync)
  3. `closeAllTabs()` (sync)
  4. Update `activeWorkspaceId` in store
  5. **`await getSyncManager().mountWorkspace(id, type)`** ← first async op, pulls fresh data
  6. `await restoreTabsForWorkspace(id)`
  7. `set({ isWorkspaceSwitching: false })`
  8. Remove old: `initializeForWorkspace`, `cleanupForWorkspace`, `pullWorkspace` calls
- `deleteWorkspace`: call `getSyncManager().unmountWorkspace(id)` before state update

**10. Update `src/hooks/use-browser-mode.ts`**:
- Remove: `AdapterRegistry`, `AdapterConfig`, `AdapterInitContext` imports, registry registration block
- Keep: `initializeFileOperations()`, sample workspace setup, `initializeSyncManager()` / `getSyncManager().start()`
- After `start()`, for non-browser active workspace: `getSyncManager().mountWorkspace(id, type)`

**11. Simplify `src/core/cache/workspace-manager.ts`**:
- Delete: `storeDirectoryHandle`, `restoreDirectoryHandle`, `requestPermissionForWorkspace`, `requestPermissionForLocalWorkspace`, `listPersistedHandles`, `removeDirectoryHandle`
- Keep: `createWorkspace`, `createSampleWorkspaceIfMissing`, `switchWorkspace` (stub), `generateWorkspaceId`, `listWorkspaces`, `getWorkspace`, `deleteWorkspace`

---

### Phase 5 — Delete Dead Files

**12. Delete these files:**
- `src/core/sync/adapter-bridge.ts`
- `src/core/sync/adapter-normalize.ts`
- `src/core/sync/adapter-registry.ts`
- `src/core/sync/adapter-types.ts`
- `src/core/sync/file-sync-queue.ts`
- `src/core/sync/file-node-bridge.ts`
- `src/core/sync/merge-strategies.ts`
- `src/core/sync/retry-policy.ts`
- `src/core/sync/sync-queue-processor.ts`
- `src/core/sync/compile-time-checks.ts`
- `src/core/sync/types/adapter-lifecycle.ts` (+ `types/` dir)
- `src/core/sync/adapters/gdrive-adapter.ts`
- `src/core/sync/adapters/s3-adapter.ts`
- `src/core/sync/adapters/gdrive-adapter-old.ts.bkp`
- `src/core/sync/adapters/local-adapter-old.ts.bkp`
- `src/core/rxdb/handle-sync.ts`

---

### Phase 6 — Test Rewrite (*depends on Phases 1–5*)

**13. Delete all 23 legacy `src/core/sync/__tests__/` files** (all reference dead API surface):
`adapter-bridge.test.ts`, `adapter-normalize.test.ts`, `local-adapter.integration.test.ts`, `local-adapter.pull.integration.test.ts`, `local-adapter.unit.test.ts`, `local-switch.integration.test.ts`, `pull-workspace.integration.test.ts`, `pull-workspace.test.ts`, `queue-persistence-retry.integration.test.ts`, `queue-processor.create.integration.test.ts`, `queue-processor.delete.integration.test.ts`, `queue-processor.integration.native.test.ts`, `queue-processor.integration.test.ts`, `queue-processor.rename.integration.test.ts`, `queue-processor.test.ts`, `startup-pull-db.integration.test.ts`, `sync-file.disable-pull.integration.test.ts`, `sync-file.pull-active-workspace.integration.test.ts`, `sync-file.push-targeting.integration.test.ts`, `sync-manager-facade.test.ts`, `sync-manager.active-workspace.test.ts`, `sync-manager.e2e.test.ts`, `workspace-types.adapters.test.ts`

**14. Write new tests in `src/core/sync/__tests__/`:**

`handle-store.unit.test.ts`
- Mock `window.indexedDB` with `fake-indexeddb`
- `setHandle` → `getHandle` roundtrip returns same object reference (structured clone test)
- `getHandle` for unknown workspaceId returns `null`
- `removeHandle` then `getHandle` returns `null`

`local-adapter.unit.test.ts`
- Mock `HandleStore`, `upsertCachedFile`, `workspace-ignore.json`
- `pull()` upserts files with `dirty: false, isSynced: true`
- `pull()` skips `.DS_Store` (ignoreNames)
- `pull()` skips `.exe` files (ignoreExtensions)
- `pull()` skips files > 5MB (maxFileSizeMB)
- `pull()` skips `node_modules/` folder and does not recurse into it
- `push()` calls `createWritable()` on the correct nested path
- `destroy()` called during `pull()` short-circuits remaining upserts
- `pull(signal)` with aborted signal short-circuits immediately

`browser-adapter.unit.test.ts`
- `pull()`, `push()`, `ensurePermission()` all resolve without error
- `shouldIncludeFile()` → always `true`
- `shouldIncludeFolder()` → always `true`

`sync-manager.unit.test.ts`
- Mock `LocalAdapter`, `BrowserAdapter`, `subscribeToDirtyWorkspaceFiles`
- `mountWorkspace('ws1', 'local')` creates `LocalAdapter`, calls `pull()`, subscribes to dirty files
- `mountWorkspace('ws2', 'browser')` creates `BrowserAdapter`, calls `pull()` (no-op)
- After 2s dirty debounce: `push()` called + `markCachedFileAsSynced()` called
- On push failure < 3 retries: file debounced again
- On push failure >= 3 retries: `updateSyncStatus(fileId, 'error')` called, no more timers
- `unmountWorkspace` calls `adapter.destroy()` + cancels pending debounce timers
- Rapid `mountWorkspace` calls (A→B→C): only C's adapter is active; A and B are destroyed

**15. Update `tests/integration/` tests referencing old sync API:**

`active-workspace-sync.test.ts` — rewrite:
- `mountWorkspace` with mock local adapter → upsert dirty file → advance fake timers 2s → verify `push()` called + file `dirty: false`

`load-local-directory-dirty.integration.test.ts` — rewrite:
- Create `LocalAdapter` with mock `FileSystemDirectoryHandle` → `pull()` → verify all upserted files have `dirty: false, isSynced: true`

`create-preserve-tree.integration.test.ts` — update:
- Use `LocalAdapter.pull()` with mock dir handle (nested structure) → verify full tree structure in RxDB

`dirty-indicator.integration.test.ts` — update:
- Remove old `registerAdapter` / `pullWorkspace` calls → use `mountWorkspace` + dirty file subscription

Keep unchanged (no sync dependency):
- `sample-workspace-sort-and-content.integration.test.ts`
- `file-explorer-headless.integration.test.ts`
- `open-sample-workspace-live-editor.integration.test.ts`

---

## Key Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Handle persistence | Vanilla `window.indexedDB` (`verve-handles` DB) | Dexie's JSON normalization pipeline can corrupt structured-clone objects; isolated DB prevents accidental migration wipes |
| Filter contract | Part of `IAdapter` interface | Allows each adapter (local, future GDrive) to define its own ignore rules |
| Permission UX | `ensurePermission()` as public method + `permissionNeeded` flag in workspace store | Guarantees user gesture for `requestPermission`; graceful fallback if auto-path fails |
| Push trigger | Per-file debounce 2s via `setTimeout` | Simple, cancellable, no RxJS dependency |
| Push retry | Max 3 attempts, exponential (2s → 5s → 10s), then `syncError` status | Handles transient failures without infinite loops |
| `pull()` fence | `_destroyed` flag + `AbortSignal` support | Prevents stale writes from concurrent workspace switches |
| GDrive/S3 | Deleted for now | Only local + browser needed; `IAdapter` interface already extensible |
| RxJS in SyncManager | Removed | Plain `setTimeout` + Zustand subscription is sufficient and simpler |

## Verification Checklist

- [ ] `yarn build` — TypeScript zero errors
- [ ] `yarn test` — all new unit tests pass
- [ ] `yarn test:integration` — integration tests pass
- [ ] Manual: create `local` workspace → directory picker opens → files appear in explorer (`dirty:false`)
- [ ] Manual: reload page → switch to local workspace → native "Allow access?" prompt → files reload
- [ ] Manual: edit file → wait 2s → verify OS file contents updated on disk
- [ ] Manual: create `browser` workspace → no prompts, no errors
- [ ] Manual: switch A→B→C rapidly → no stale files leak between workspaces
- [ ] Manual: revoke permission → open local workspace → UI shows error state (not infinite spinner)

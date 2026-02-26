Prompt 1 — "Introduce adapter capability interfaces and adapter translator"
- Goal: Create `src/core/sync/adapter-types.ts` with small interfaces `IPushAdapter`, `IPullAdapter`, `IWatchableAdapter`, `IWorkspaceAdapter`. Keep `ISyncAdapter` as composition.
- Tasks:
  - Add the new file with exported interfaces and a canonical `AdapterFileDescriptor` type: { id: string; path: string; metadata?: Record<string, any> }.
  - Update gdrive-adapter.ts to implement `IPushAdapter` and `IPullAdapter` and adapt current signatures to use `AdapterFileDescriptor`.
  - Add translation helper `adapter-bridge.ts` that converts `CachedFile` -> `AdapterFileDescriptor`.
- Tests:
  - Unit test that `adapter-bridge` maps `CachedFile` correctly.
  - Compile-only test to ensure `gdrive-adapter` implements new interfaces.
- Safety: Keep current `ISyncAdapter` exported and add deprecation comments. No behavior changes.

Prompt 2 — "Extract RetryPolicy and persist sync queue"
- Goal: Move retry logic out of `SyncManager` and persist queue entries in `sync_queue` RxDB collection.
- Tasks:
  - Implement `src/core/sync/retry-policy.ts` with configurable backoffs.
  - Add `sync-queue-processor.ts` that reads pending items from RxDB `sync_queue` and processes items idempotently using `upsert` to mark attempts.
  - Modify `SyncManager` to enqueue dirty files into the persistent `sync_queue` instead of directly calling adapter.push.
- Tests:
  - Add unit tests that simulate adapter failures; verify `sync_queue` entries persist and are retried after simulated restart.
- Safety: Keep original `performSync` logic behind a feature flag until new queue proven stable.

Prompt 3 — "Do not overwrite local content on pull — add MergeStrategy abstraction"
- Goal: Prevent blind overwrite and add merge strategies.
- Tasks:
  - Add `merge-strategies.ts` with `NoOp`, `ThreeWay` placeholders and plugin points.
  - Update `SyncManager` to call merge strategy when pull returns content instead of immediate `saveFile`.
  - Default config = NoOp which records remote content to `remote_versions` record and emits an event.
- Tests:
  - Simulate scenario: local content differs, remote content differs -> verify `remote_versions` created and local content unchanged.
- Safety: Default behavior remains non-destructive (no overwrite) unless admin flips a well-tested flag.

Prompt 4 — "Optimize DB queries and indexes"
- Goal: Replace JS filters with RxDB queries and add indexes.
- Tasks:
  - Update schemas.ts to add indexes on `path`, `workspaceId`, `dirty`.
  - Refactor `listFiles` and `getAllFiles` to use `.find({ selector: ... })` with $or/$and queries and limit/skip for pagination.
- Tests:
  - Add performance test that inserts 10k small files into in-memory RxDB and verifies `listFiles` returns first-page within threshold.
- Safety: Keep API shape of `listFiles` unchanged; add optional pagination params.

Prompt 5 — "Decouple editor store from persistence"
- Goal: Add `IFileRepository` and inject into editor store.
- Tasks:
  - Create `src/core/cache/file-repo.ts` exporting interface and default implementation delegating to `file-operations`.
  - Change `editor-store` to import repository from a single provider; keep existing `loadFileFromManager` and `applyEditorPatch` behavior.
- Tests:
  - Add unit tests that mock `IFileRepository` to validate editor store behavior (no DB required).
- Safety: Expose a default provider that returns current implementation so runtime behavior is unchanged.

Prompt 6 — "Add adapter mocks & integration tests"
- Goal: Provide deterministic tests for sync flows.
- Tasks:
  - Add `tests/mocks/gdrive-mock.ts` implementing adapter interface but deterministic.
  - Add integration test: saveFile -> queue -> run processor -> assert mock received push and RxDB cleaned dirty flag.
- Safety: Tests only, no runtime changes.

Each PR should:
- Be small (1–3 files changed), include TypeScript types, and include unit tests that run in CI.
- Include migration notes if schema changes are required (e.g., adding indexes).
- Keep default behavior unchanged behind feature flags when possible.

---

New Prompts: Simplified authoritative push/pull workflow

Overview
- We will simplify sync semantics: the active workspace is authoritative for writes (push), and pushes immediately overwrite source (no conflict resolution).
- Pulls only occur during workspace switches or app reloads and will overwrite local cached files (no merge/conflict management). Background polling and watcher-driven pulls are disabled by default.

Prompt A — "Authoritative push (active workspace overwrite)"
- Goal: Treat saves originating from the active workspace as authoritative and ensure they are pushed to remote immediately (or enqueued for durable push) and marked synced on success.
- Tasks:
  - Ensure `applyEditorPatch` / `saveFile` triggers a push for the active workspace. Use the existing `SyncManager` push/enqueue flow; when `usePersistentQueue` is enabled, enqueue and process the queue immediately for the active workspace.
  - After a successful push, clear the `dirty` flag via `markCachedFileAsSynced`.
  - Preserve `file-operations` as the single source of truth — pushes are side-effects handled by `SyncManager` / queue processor.
- Tests:
  - Unit test that saving a file from the editor results in a push call (or a queue entry) and that the cached file `dirty` flag is cleared on success.
- Safety:
  - No change to pull behavior. Behavior limited to active workspace saves only. Backwards-compatible when queue disabled.

Prompt B — "Pull only on workspace switch or app reload (authoritative overwrite)"
- Goal: Only perform remote pulls when a workspace becomes active (app startup or user switches workspace). Pulled content overwrites local cache without merge logic.
- Tasks:
  - Add `SyncManager.pullWorkspace(workspaceId?: string)`:
    - Prefer adapter-level `pullWorkspace` or `listWorkspaceFiles` + `pull` when adapter supports it.
    - For each remote file, call `saveFile(path, content, workspaceType, metadata, workspaceId)` to overwrite the cache and set `dirty: false`.
  - Wire `pullWorkspace` into startup and workspace-switch flows:
    - On app init, after `initializeFileOperations()` and `initializeSyncManager()`, call `await syncManager.pullWorkspace(activeWorkspaceId)` for non-browser workspaces.
    - On workspace switch (blocking switch), call `await syncManager.pullWorkspace(newWorkspaceId)` before rendering the new workspace.
- Tests:
  - Integration test: adapter returns a set of files; `pullWorkspace` upserts/overwrites `cached_files` and clears `dirty`.
  - Unit test: verify `pullWorkspace` calls adapter methods and `saveFile` is used for each file.
- Safety:
  - Explicit opt-in only during switch/startup; no background pulls.

Prompt C — "Disable background pulls & watchers by default"
- Goal: Prevent unexpected remote-driven overwrites by disabling periodic pulls and adapter.watch polling by default.
- Tasks:
  - Remove automatic `setupRemoteWatchers()` and periodic pull timer from `SyncManager.start()`.
  - Add explicit opt-in methods: `enableRemoteWatching()` and `enablePeriodicPull(ms)` to start watchers/pulls when the app or user enables them.
- Tests:
  - Unit tests that verify `SyncManager` does not start watchers/pulls by default and that opt-in methods start them.
- Safety:
  - Reversible and opt-in; default behavior matches your simplified workflow.

Prompt D — "Tests for pull-on-switch semantics"
- Goal: Add coverage ensuring pulls on workspace switch overwrite cache and are deterministic.
- Tasks:
  - Integration tests (use `fake-indexeddb` + in-memory RxDB) for:
    - App init pull: startup calls `pullWorkspace` and cache is populated/overwritten.
    - Workspace switch pull: switching workspaces triggers pull and updates cache.
  - Mock adapters for determinism.
- Safety:
  - Use isolated test DB instances; avoid touching real IndexedDB in CI.

Prompt E — "Docs & migration notes"
- Goal: Document the new simplified workflow and any schema/index changes.
- Tasks:
  - Update `docs/Refactor.md` and the architecture docs to state:
    - Active workspace writes are authoritative and push to source.
    - Pulls only on workspace switch/app reload and overwrite local cache.
    - How to opt into watchers/pulls for advanced use cases.
  - Add migration note if schema updates are required (e.g., `sync_queue` indexes or `cached_files` indexes).

Implementation guidance (safety-first)
- Make each prompt a small PR (1–3 files) with tests and clear migration notes.
- Keep feature flags and opt-in methods so teams can roll back if needed.
- Prefer durable queue approach already added for push reliability; process the queue immediately for current workspace to minimize latency.

Would you like me to implement Prompt A (push-overwrite) now? If yes, I will create the patch and tests as a small PR.
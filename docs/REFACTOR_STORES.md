## Plan: Simplify File Explorer State & Fix Create Flow

TL;DR — Root cause: the store builds mixed map keys and mixed child shapes (path-keyed vs id-keyed entries, object-children vs id-arrays), causing rendering to use an incomplete set of `rootIds` after create. I'll implement the refactor and tests (per your choice), migrate folder IDs to RxDB-generated ids, and make `fileMap + rootIds` the canonical in-memory representation while deriving `fileTree` on demand.

**Steps**
1. Fix canonical cache builder
   - Edit file-explorer-store.ts: replace `_buildFileTreeFromCache` with a canonical builder that
     - normalizes paths (no leading/trailing slash),
     - uses RxDB-generated ids for files and folders (migrate folders into `cached_files` with their own ids),
     - produces `fileMap` keyed only by `id` with `children: string[]`,
     - reliably computes `rootIds`.
2. Add DB folder entries & migration
   - Edit file-operations.ts and rxdb.ts:
     - add helper to create folder documents (if not present) returning id,
     - on folder creation, persist a `cached_files` doc for the folder so folders and files share id space.
   - Add simple migration to create folder docs for existing folder paths (only when needed).
3. Simplify store shape & API
   - In file-explorer-store.ts:
     - remove persisted `fileTree` from the store; keep `fileMap` + `rootIds` as canonical persisted memory (persist minimal state for UX like expandedFolders).
     - expose a `getFileTree()` selector that builds object-tree from `fileMap`+`rootIds` when needed (for filtering/tests).
     - ensure `createFile`, `createFolder`, `renameNode`, `deleteNode` update RxDB via `file-operations` and then refresh `fileMap`+`rootIds` atomically.
4. Update UI consumers
   - Edit file explorer components to consume `getChildren(id)` + `fileMap` + `rootIds` exclusively:
     - file-explorer.tsx
     - file-tree-item.tsx
     - remove incidental usage of `fileTree` object except where `getFileTree()` is explicitly required.
5. Tests and verification
   - Add/modify tests:
     - preserve-tree-on-create.integration.test.ts: reproduce create->save->refresh and assert `rootIds` and `fileMap` include prior nodes.
     - Unit test for `_buildFileTreeFromCache` (or exported builder) verifying id-keyed `fileMap`, `children` arrays of ids, and correct `rootIds`.
6. Safety & migration
   - Add migration that creates folder docs for any folder-only paths found in cached files; run at app start if needed.
   - Keep compatibility layer: if a consumer still requests `fileTree` from store, compute it from `fileMap` to avoid breaking tests temporarily.

**Verification**
- Manual: open app, create file in nested folder; confirm folder remains expanded and its children list includes the new file.
- Automated:
  - Run unit tests: `yarn test` (or repo test command) — new tests pass.
  - Integration test that previously failed (if any) should now pass: preserve-tree-on-create.integration.test.ts.
- Spot checks:
  - `useFileExplorerStore.getState().fileMap` contains only id keys.
  - `getChildren(id)` returns array of ids; ui mapping `id -> fileMap[id]` yields consistent tree.

**Decisions (per your answers)**
- Implement the refactor & tests.
- Folder IDs: use RxDB-generated ids for folders (requires creating/persisting folder docs).
- Store shape: canonical `fileMap + rootIds`, compute `fileTree` on demand.

**Flow diagram (high-level ASCII)**
UI components (create/rename/delete) 
  --> call `useFileExplorerStore` methods (createFile/createFolder/renameNode/deleteNode)
    --> call Core file repo API (file-operations.ts) which upserts to RxDB `cached_files`
      --> RxDB persists file/folder doc and returns doc id
        --> file-explorer store refreshes canonical view by calling `getAllFiles(workspaceId)` -> rebuilds `fileMap` + `rootIds`
          --> UI renders from `rootIds` and `fileMap` (getChildren(id) -> fileMap[childId])

Workspace CRUD interactions:
- Workspace selection (`workspace-store`) scopes `getAllFiles(workspaceId)` and `saveFile(..., workspaceId)` so all file ops are save/read-scoped by workspace id.
- Workspace create/delete: create -> new workspace id; file-explorer store `refreshFileTree` will run against the new workspace (empty).
- Workspace delete: delete workspace -> remove RxDB docs for that workspace -> store `fileMap` becomes empty.

**Files to edit**
- file-explorer-store.ts
- file-operations.ts
- rxdb.ts
- file-explorer.tsx
- file-tree-item.tsx
- Tests in src/features/file-explorer/__tests__/*

Next step: I can start implementing the refactor and tests now (I’ll:
- add folder docs in RxDB,
- replace the cache builder in the store,
- update UI consumers,
- add tests and run them).
Proceed?

User: Can you create a full document with clear tasks wise goals.

include each tasks integration tests and checking redundant and bloat code protection.

GitHub Copilot: I'll create a tracked todo plan for the refactor and then share a full task document with tests and redundancy protections.

Created 10 todos

**Overview**
- **Goal:** Simplify file-explorer state to use RxDB as single source of truth, fix the create-file disappearance bug, remove redundant in-memory representations, add migrations for folders, tighten UX-consistent APIs, and add tests + runtime checks to prevent re-introduction of bloat.
- **Canonical decision:** Persist files and folders as `cached_files` documents in RxDB. In-memory canonical representation = `fileMap` (id-keyed nodes with `children: string[]`) + `rootIds`. Compute object `fileTree` on demand.

**Tasks (detailed)**
- **1. DB Folder Migration**
  - **Goal:** Ensure folders have RxDB docs and stable ids (use DB-generated ids).
  - **Files:** file-operations.ts, rxdb.ts, schemas.ts
  - **Work:** Add `createFolderDoc(path, workspaceId)` that upserts a folder doc; add an optional startup migration to convert path-only folders into docs.
  - **Integration Test:** `tests/integration/migrations/create-folder-docs.integration.test.ts` — seed `cached_files` with files whose folder paths are missing folder docs → run migration → assert folder docs exist and have stable ids and parent/child relationships.
  - **Redundancy/Bloat Check:** Detect duplicate path-only folder entries and log warnings during migration.

- **2. Canonical Cache Builder**
  - **Goal:** Replace `_buildFileTreeFromCache` with a builder that produces `fileMap` keyed by `id` only; no path-keyed leftovers; `children` arrays contain ids.
  - **Files:** file-explorer-store.ts
  - **Work:** Normalize paths, ensure deterministic root collection, remove path-keyed map entries before calling `set`.
  - **Unit Test:** `src/features/file-explorer/__tests__/build-cache.unit.test.ts` — create mocked `getAllFiles` results, assert `fileMap` shape (only id keys), `children` arrays are ids, `rootIds` correct.
  - **Redundancy/Bloat Check:** Add an assertion helper (dev-only) that fails if `fileMap` contains any non-id keys.

- **3. Refactor Explorer Store**
  - **Goal:** Make store canonical state `fileMap + rootIds`; remove persistent `fileTree`; expose `getFileTree()` selector to compute nested objects on demand.
  - **Files:** file-explorer-store.ts
  - **Work:** Keep persisted UI preferences (expandedFolders, selectedFileId) only. Ensure `createFile/createFolder/renameNode/deleteNode` call core ops then atomically refresh `fileMap`+`rootIds`.
  - **Integration Test:** `src/features/file-explorer/__tests__/create-preserve-tree.integration.test.ts` — create a nested folder+file, assert pre-existing siblings remain visible and expanded state preserved after create.
  - **Redundancy/Bloat Check:** Lint rule or runtime check to warn on storing nested object trees in the store.

- **4. Update File Operations**
  - **Goal:** Normalize paths and return canonical ids for folders/files. Ensure `saveFile` returns file id; `createDirectory` returns folder id.
  - **Files:** file-operations.ts
  - **Work:** Normalize path input (strip leading/trailing slashes), create folder docs as needed, return ids.
  - **Integration Test:** `tests/integration/file-ops.return-ids.integration.test.ts` — call `createDirectory` and `saveFile`, assert returned ids are present in RxDB and used by explorer builder.

- **5. UI Consumers Update**
  - **Goal:** Make explorer components rely only on `fileMap + rootIds + getChildren(id)`; remove `fileTree` dependence (except for one-off filtering callers that will call `getFileTree()`).
  - **Files:** file-explorer.tsx, file-tree-item.tsx
  - **Work:** Replace object-child traversal with id-based traversal; ensure expand/collapse logic uses ids.
  - **Integration Test:** `src/features/file-explorer/__tests__/ui-render.integration.test.ts` — mount component, simulate create, assert DOM contains expected nodes and expanded states.

- **6. Remove Redundant Code**
  - **Goal:** Remove dead helpers and duplicate logic (path-keyed maps, duplicate sorting branches).
  - **Files:** the store, helpers directory: `src/features/file-explorer/store/helpers/*`
  - **Work:** Delete or consolidate helpers; keep small, well-documented single-responsibility functions.
  - **Protection:** Add PR checklist item to run a small script to detect removed-but-referenced symbols (CI fails if broken).
  - **Integration Test:** None direct; rely on unit and integration tests to catch breakages.

- **7. Tests: Unit & Integration**
  - **Goal:** Add targeted tests for the create-file bug and guard regressions.
  - **Tests to add:**
    - Unit: `build-cache.unit.test.ts`, `path-normalize.unit.test.ts`
    - Integration: `create-preserve-tree.integration.test.ts`, `migrations/create-folder-docs.integration.test.ts`, `file-ops.return-ids.integration.test.ts`, `ui-render.integration.test.ts`
  - **Checks:** Tests assert `fileMap` shape, `rootIds` completeness, UI preserved expansions, no duplicate keys.

- **8. Runtime Bloat Protection**
  - **Goal:** Prevent accidental re-introduction of heavy derived state.
  - **Work:**
    - Add dev-only invariant functions in store: `assertCanonicalMap()` checks key shapes and maximum map sizes (configurable).
    - Add ESLint rule or custom lint script to flag storing nested object trees in zustand persist partialize payload.
    - Add `console.warn` if `persist` partialize attempts to store `fileMap` with > N entries (configurable).
  - **Integration Test:** `tests/e2e/bloat-detection.integration.test.ts` — simulate storing huge fileMap and expect dev warning.

- **9. Docs & Flow Diagram**
  - **Goal:** Produce a simple flow diagram and developer doc explaining data flow and invariants.
  - **Files:** New doc: `docs/FILE_EXPLORER_REFACTOR.md`
  - **Include:** ASCII or Mermaid flow diagram, before/after state shapes, migration steps, tests to run.
  - **Deliverable:** The full document (I will produce it now as part of this task).

- **10. Run Tests & CI**
  - **Goal:** Update CI to run new tests and fail on regressions.
  - **Work:** Add test scripts if needed, run `yarn test src/features/file-explorer --runInBand` locally and in CI; ensure migration runs in test fixtures.
  - **Commands:**
    - Run all tests:
      ```
      yarn test
      ```
    - Run file-explorer tests:
      ```
      yarn test src/features/file-explorer --runInBand
      ```

**Flow Diagram (text)**
- UI (create/rename/delete) → `useFileExplorerStore` API → Core file repo (`saveFile`/`createDirectory`) → RxDB `cached_files` upsert → store refresh: `getAllFiles(workspaceId)` → canonical builder → store sets `fileMap` + `rootIds` → UI renders from `rootIds` & `fileMap` (getChildren(id) -> fileMap[id]).

**Integration tests (concise list & assertions)**
- `create-preserve-tree.integration.test.ts`
  - Arrange: workspace with folder A containing files X, Y.
  - Act: create new file Z inside A via UI/store.
  - Assert: A still present in `rootIds` (or as child in parent), A is expanded if previously expanded, children include X,Y,Z, UI shows Z.
- `migrations/create-folder-docs.integration.test.ts`
  - Arrange: Seed RxDB with files with paths containing directories but no folder docs.
  - Act: run migration.
  - Assert: folder docs created with ids; `fileMap` includes folder ids; no path-keyed map entries.
- `build-cache.unit.test.ts`
  - Arrange: mock `getAllFiles` returns mixed files and dir entries.
  - Act: call builder.
  - Assert: `fileMap` only id keys, `children` arrays are ids, `rootIds` correct.
- `ui-render.integration.test.ts`
  - Render file-explorer component with real store (test harness).
  - Simulate create folder & file operations.
  - Assert: DOM contains nodes and preserves expanded state.
- `file-ops.return-ids.integration.test.ts`
  - Assert `saveFile` & `createDirectory` return stable ids and RxDB contains the doc.

**Redundancy and bloat code protection**
- Add dev-only invariants in the store:
  - `assertNoPathKeys(fileMap)`: throws in dev if keys contain slashes or non-UUID patterns.
  - `assertChildrenAreIds(node)`: warns if `children` contains objects.
- Persist only minimal UX in `persist.partialize`: `expandedFolders`, `selectedFileId`, `currentDirectoryName`, `currentDirectoryPath`. Do not persist `fileMap` unless necessary; if persisted, ensure shape validation on rehydrate.
- Add a pre-commit lint script to run a small analyzer script that checks for direct references to `fileTree` in components (flag for review).

**Deliverables**
- Code changes across the files listed above implementing the migration and refactor.
- New tests in `src/features/file-explorer/__tests__` and `tests/integration`.
- `docs/FILE_EXPLORER_REFACTOR.md` with flow diagram, migration notes, tests to run.
- Dev runtime checks and lightweight lint script.

**Next actions (I will do first)**
- Continue with task #1 (DB Folder Migration) implementation and write the migration integration test noted above. Would you like me to proceed and open the PR with changes and tests now?**Flow Diagram (text)**
- UI (create/rename/delete) → `useFileExplorerStore` API → Core file repo (`saveFile`/`createDirectory`) → RxDB `cached_files` upsert → store refresh: `getAllFiles(workspaceId)` → canonical builder → store sets `fileMap` + `rootIds` → UI renders from `rootIds` & `fileMap` (getChildren(id) -> fileMap[id]).

**Integration tests (concise list & assertions)**
- `create-preserve-tree.integration.test.ts`
  - Arrange: workspace with folder A containing files X, Y.
  - Act: create new file Z inside A via UI/store.
  - Assert: A still present in `rootIds` (or as child in parent), A is expanded if previously expanded, children include X,Y,Z, UI shows Z.
- `migrations/create-folder-docs.integration.test.ts`
  - Arrange: Seed RxDB with files with paths containing directories but no folder docs.
  - Act: run migration.
  - Assert: folder docs created with ids; `fileMap` includes folder ids; no path-keyed map entries.
- `build-cache.unit.test.ts`
  - Arrange: mock `getAllFiles` returns mixed files and dir entries.
  - Act: call builder.
  - Assert: `fileMap` only id keys, `children` arrays are ids, `rootIds` correct.
- `ui-render.integration.test.ts`
  - Render file-explorer component with real store (test harness).
  - Simulate create folder & file operations.
  - Assert: DOM contains nodes and preserves expanded state.
- `file-ops.return-ids.integration.test.ts`
  - Assert `saveFile` & `createDirectory` return stable ids and RxDB contains the doc.

**Redundancy and bloat code protection**
- Add dev-only invariants in the store:
  - `assertNoPathKeys(fileMap)`: throws in dev if keys contain slashes or non-UUID patterns.
  - `assertChildrenAreIds(node)`: warns if `children` contains objects.
- Persist only minimal UX in `persist.partialize`: `expandedFolders`, `selectedFileId`, `currentDirectoryName`, `currentDirectoryPath`. Do not persist `fileMap` unless necessary; if persisted, ensure shape validation on rehydrate.
- Add a pre-commit lint script to run a small analyzer script that checks for direct references to `fileTree` in components (flag for review).

**Deliverables**
- Code changes across the files listed above implementing the migration and refactor.
- New tests in `src/features/file-explorer/__tests__` and `tests/integration`.
- `docs/FILE_EXPLORER_REFACTOR.md` with flow diagram, migration notes, tests to run.
- Dev runtime checks and lightweight lint script.

**Next actions (I will do first)**
- Continue with task #1 (DB Folder Migration) implementation and write the migration integration test noted above. Would you like me to proceed and open the PR with changes and tests now?
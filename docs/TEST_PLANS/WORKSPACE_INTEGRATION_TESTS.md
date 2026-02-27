# Workspace Integration Tests Plan

## Goal
Add robust integration tests for workspaces and workspace types that verify UI file-tree behavior and background sync to adapters (browser/local/gdrive). Tests should be maintainable, reusable, and landed in small PRs.

## High-level scope
- Workspace behaviours: create, switch, create/read/delete workspaces
- Default workspace file: `verve.md` created with content `# Verve 🚀` and instantly visible in file tree
- File-tree CRUD: create/read/update/delete files and directories (nested hierarchies)
- Workspace Types: ensure each workspace type (browser/local/gdrive) initializes RxDB and uses mocked adapters; CRUD operations should update UI immediately and sync to the mocked source in background

## Test infra & fixtures
- Add integration tests under `src/core/store/__tests__/` naming `workspace.integration.test.ts` (existing file is current working file)
- Provide helpers in `src/core/store/__tests__/helpers/`:
  - `rxdbTestHarness.ts` — create ephemeral RxDB instance for tests
  - `mockAdapterFactory.ts` — provide mocks for browser/local/gdrive adapters with programmable delays/errors
  - `workspaceTestHelpers.ts` — helpers: `createWorkspace`, `switchWorkspace`, `createFile`, `createDir`, `deleteFile`, `assertFileTreeMatches`
  - `uiHelpers.ts` — utilities to mount components (React Testing Library), simulating file-tree interactions and asserting UI updates
- Use Jest + jsdom (existing project already uses Jest). Prefer `@testing-library/react` for UI interactions and `msw` for network mocking if needed.

## Reusable assertions
- `expectFileTreeStructure(treeRoot, expectedHierarchy)` — verifies DOM tree items and order
- `expectFileContent(path, expectedContent)` — verifies file content read from RxDB or mocked source
- `waitForBackgroundSync(adapter, predicate)` — waits until adapter mock reports expected change (useful for asserting background sync)

## PR breakdown (small, reviewable PRs)
PR 1: docs + TODO tracking
- Files: `docs/TEST_PLANS/WORKSPACE_INTEGRATION_TESTS.md`
- Purpose: land this plan and TODOs
- Acceptance: plan file present and tracked

PR 2: Test infra + basic helpers
- Files: `src/core/store/__tests__/helpers/*` and jest setup tweaks if necessary
- Purpose: add `rxdbTestHarness`, `mockAdapterFactory`, `workspaceTestHelpers`, `uiHelpers`
- Acceptance: unit tests demonstrate harness usage (small smoke tests)

PR 3: Workspace create/switch tests
- Files: `src/core/store/__tests__/workspace.create-switch.test.ts`
- Purpose: tests that creating a workspace and switching to it reloads files preserving hierarchy
- Acceptance: tests pass using mock adapters and harness

PR 4: Default `verve.md` tests
- Files: `src/core/store/__tests__/workspace.default-file.test.ts`
- Purpose: verify new workspace always has `verve.md` with `# Verve 🚀` visible immediately
- Acceptance: UI shows `verve.md` instantly after workspace creation

PR 5: Create/Read/Delete workspace tests
- Files: `src/core/store/__tests__/workspace.crud.test.ts`
- Purpose: test workspace lifecycle operations
- Acceptance: creation, listing, deletion flows work and UI updates accordingly

PR 6: Workspace-type adapter integration tests
- Files: `src/core/store/__tests__/workspace.adapters.test.ts`
- Purpose: initialize browser/local/gdrive workspace types with mocked adapters and verify RxDB integration and adapter calls
- Acceptance: adapter mocks receive expected calls; background sync triggers

PR 7: File/dir CRUD across types
- Files: `src/core/store/__tests__/workspace.files-crud.test.ts`
- Purpose: run deep CRUD tests on nested hierarchies ensuring UI instant updates and background adapter sync
- Acceptance: UI matches expected hierarchy; adapter confirms persisted changes

PR 8: Refactor old tests to use helpers
- Purpose: consolidate duplicated setup and assertions into helper functions to keep tests maintainable
- Acceptance: tests updated and passing; helper functions well-documented

PR 9: Run CI, fix flaky tests, document known caveats
- Purpose: stabilize tests and add flakiness mitigations (timeouts, deterministic mocks)

## Test cases (detailing key tests)
1) Create workspace / switch space
- Setup: use `mockAdapterFactory()` to fake an existing file hierarchy for workspace A and workspace B
- Steps: create workspace A with a nested hierarchy; create workspace B; switch from A -> B -> A
- Assertions: after each switch, UI file tree shows the exact hierarchy that belongs to that workspace; file contents map to that workspace's files

2) Default `verve.md` test
- Steps: create a new workspace (any type)
- Assertions: file-tree shows `verve.md` immediately; open file reads `# Verve 🚀`; RxDB contains the file entry; adapter receives create call in background

3) Create / Read / Delete workspaces
- Steps: create workspace X; list workspaces; delete workspace X
- Assertions: creation adds to workspace list and shows its file tree; deletion removes workspace and any persisted metadata; UI updates

4) Workspace type adapter & RxDB setup
- For each type: browser/local/gdrive
- Steps: create workspace of that type using mock adapter; perform a file create, update, delete in UI
- Assertions: RxDB collection is updated; adapter mock receives persisted changes; UI shows changes instantly

5) CRUD on files/directories with nested hierarchy
- Steps: create nested dirs and files, rename, move, delete files and dirs deeply
- Assertions: UI tree updates instantly; adapter syncs the changes (assert with `waitForBackgroundSync`); subsequent reload recovers same hierarchy

## Implementation details & best practices
- Keep adapters fully mockable and inspectable — allow tests to inject a `MockAdapter` exposing a call log and methods to assert persisted state.
- Avoid heavy timing-based assertions — prefer event-driven waits and adapter call logs.
- Isolate RxDB instances per test using the `rxdbTestHarness` and clear DB between tests.
- Use small, focused tests rather than huge end-to-end scenarios to reduce flakiness.
- For UI interactions, prefer `userEvent` from `@testing-library/user-event` rather than direct DOM events.

## When tests fail
- Triage failures: identify if failure is due to test flakiness (timing, network), bug in feature, or missing mock behavior
- If feature bug: produce a minimal failing test and a small fix in the same PR (explain in PR description) — prefer small, targeted code changes
- If test issue: enhance harness/mocks or assertion helpers to be deterministic

## Example PR description template
- Title: `test(workspace): add create/switch integration tests`
- Summary: brief summary
- Checklist:
  - [ ] Adds test helper harnesses
  - [ ] Adds create/switch integration test
  - [ ] Uses mock adapters
  - [ ] CI passes locally
- Notes: include reproduction steps and how to run the new tests locally

## How to run tests locally
- Use project jest runner. Example:

```bash
yarn test src/core/store/__tests__/workspace.integration.test.ts --watch
```

## Next steps (recommended order)
1. Land PR 2 (test infra + helpers)
2. Land PR 3 + PR 4 (workspace behaviors + default file)
3. Land PR 5 (CRUD workspaces)
4. Land PRs 6-7 (adapters + file CRUD across types)
5. Consolidate in PR 8 and stabilize in PR 9

---

If you want, I can now scaffold the helper files and a first skeleton test for "default verve.md" (PR 2+4). Which PR should I start with?
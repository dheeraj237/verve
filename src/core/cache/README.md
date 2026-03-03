# Cache Module

This folder contains the offline cache layer built on RxDB. Key modules:

- `file-manager.ts` — primary API for file and directory CRUD. Exposes functions like `saveFile`, `loadFile`, `deleteFile`, `listFiles`, and subscription helpers (`subscribeToWorkspaceFiles`). All file operations are scoped by `workspaceId`.
- `workspace-manager.ts` — workspace lifecycle helpers. Use `createWorkspace`, `switchWorkspace`, and `createSampleWorkspaceIfMissing`. Workspace IDs are generated with `generateWorkspaceId` to ensure deterministic behavior in tests.
- `sample-loader.ts` — populates a workspace with markdown sample files from `public/content`. It uses `fetch` (browser) and is easy to mock in tests.
- `schemas.ts` — RxDB JSON schemas for `cached_files` and `sync_queue`. Includes composite index `['workspaceId','path']` for efficient workspace-scoped lookups.

Guidance:
- Prefer `file-manager` for all file CRUD and subscription needs. Legacy `file-operations.ts` has been removed; update imports to `file-manager`.
- Tests should mock `fetch` when `sample-loader` runs in Node environments.
- If adding new workspace IDs in tests, reuse `generateWorkspaceId` when deterministic formatting is required.

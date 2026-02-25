# RxDB + Yjs CRDT Architecture for Offline-First Editing

## Goal
Provide an offline-first cache layer using RxDB and Yjs (CRDT) with **workspace-aware sync**:

- **Browser workspace**: Purely local, no sync needed (IndexedDB only)
- **Local workspace**: Sync to file system (LocalAdapter)
- **GDrive workspace**: Sync to Google Drive (GDriveAdapter)
- **S3 workspace** (future): Sync to S3/compatible storage (S3Adapter)

**Data flow:**
```
UI → RxDB (cached file + CRDT doc) → SyncManager → Adapters → Remote Storage
```

For **browser workspace**, sync is skipped entirely since data stays local.

## High-level flow

1. User opens/edits a file in UI. Editor binds to a Yjs doc synced to an RxDB `crdt_docs` entry.
2. Changes are applied locally to Yjs; RxDB stores the Yjs state (attachment or binary blob) and a lightweight `cached_files` record for file metadata and pointers.
3. `SyncManager` observes RxDB collections and adapter change events. It pushes local deltas to remote adapters and pulls remote changes into RxDB.
4. Yjs provides automatic conflict resolution when merges occur; final state is written back to RxDB and emitted to UI subscribers.

## Collections & Data Model

### Workspace Types
- `browser` — Local IndexedDB only (no sync, no dirty flag)
- `local` — Desktop/electron filesystem (synced via LocalAdapter)
- `gdrive` — Google Drive (synced via GDriveAdapter)
- `s3` — S3-compatible storage (synced via S3Adapter, future)

### Collections

- `cached_files` (RxDB collection)
  - id: string (UUID or path-based)
  - name: string
  - path: string
  - type: 'file' | 'dir'
  - **workspaceType**: 'browser' | 'local' | 'gdrive' | 's3' (determines sync adapters)
  - crdtId?: string (FK to `crdt_docs`)
  - metadata: object (size, mime, driveId, remoteETag)
  - lastModified: number (ms)
  - dirty: boolean (local unsynced changes, only for non-browser workspaces)

- `crdt_docs` (RxDB collection)
  - id: string (crdtId)
  - fileId: string (FK to cached_files)
  - yjsState: binary/attachment (encoded Yjs update/state vector)
  - lastUpdated: number

- `sync_queue` (optional)
  - records representing operations to push: { op: 'put'|'delete', target: 'file'|'crdt', id, payload }

Notes:
- Store Yjs state as base64 string in `crdt_docs` for easy serialization
- Keep metadata in `cached_files` for quick UI rendering
- `dirty` flag not used for browser workspace (always stays in IndexedDB)

## Key Components

- `src/core/cache/rxdb.ts` — RxDB setup and collection registration (Dexie/IndexedDB adapter for browser)
- `src/core/cache/schemas.ts` — JSON schemas for RxDB collections
- `src/core/cache/yjs-adapter.ts` — helpers to load/save Yjs state into `crdt_docs` and create `Y.Doc` instances wired to RxDB
- `src/core/sync/sync-manager.ts` — central sync orchestrator. Watches RxDB for dirty files, coordinates with adapters based on workspace type, handles retries
- `src/core/sync/adapters/*` — implementations for:
  - `local-adapter.ts` — File system sync (electron/desktop)
  - `gdrive-adapter.ts` — Google Drive sync
  - `s3-adapter.ts` — S3/compatible storage sync (future)
- `src/features/editor/store/editor-cache-bridge.ts` — UI glue to open a file: returns a Yjs `Doc` instance and subscribes to RxDB changes

**Note:** Browser workspace files have `workspaceType: 'browser'` and are never synced — they remain local to IndexedDB.

## Conflicts & Resolution

- Use Yjs for CRDT merging (text types / maps). Yjs merges are deterministic and will resolve concurrent edits automatically.
- For metadata conflicts (e.g., delete vs edit), `SyncManager` should implement application-level rules: e.g., tombstones, last-write-with-vector, or prompt user when ambiguous.

## Offline & Persistence

- Use RxDB with the Dexie (IndexedDB) adapter for browser persistence.
- When offline, UI continues to edit Yjs docs; the `dirty` flag marks files to sync once online (for non-browser workspaces).
- **Browser workspaces**: No syncing occurs — all changes are permanently stored in IndexedDB and never leave the browser.
- **Local/GDrive/S3 workspaces**: Changes synced to remote adapters when online; dirty flag allows retry on reconnection.

## Required packages (initial)

- rxdb
- yjs
- y-protocols (optional for awareness)
- @yjs/encoding or utilities to encode state (if necessary)
- rxdb/plugins/attachments (if using attachments)
- rxdb/plugins/leader-election (optional for multi-tab sync)
- idb or the RxDB-provided IDB adapter

Install example:

```bash
yarn add rxdb yjs
```

## Files to add (suggested)

- src/core/cache/rxdb.ts — RxDB init and exports
- src/core/cache/schemas.ts — JSON schemas for `cached_files`, `crdt_docs`, `sync_queue`
- src/core/cache/yjs-adapter.ts — create/load/save Yjs docs
- src/core/sync/sync-manager.ts — orchestrator
- src/core/sync/adapters/local-adapter.ts
- src/core/sync/adapters/gdrive-adapter.ts
- src/core/sync/adapters/browser-adapter.ts
- src/features/editor/store/editor-cache-bridge.ts — UI-facing helpers
- tests/sync/* — unit/integration tests

## Recommended incremental implementation plan

1. Add RxDB schemas and bootstrapping (`rxdb.ts`, `schemas.ts`).
2. Implement `crdt_docs` storage and `yjs-adapter.ts` to hydrate `Y.Doc` from RxDB.
3. Expose UI helper to open file and get `Y.Doc` and subscribe to metadata changes.
4. Implement `SyncManager` core to push/pull changes (start with polling for local/GDrive adapters).
5. Implement adapters, wire push/pull, mark `cached_files.dirty` and clear on success.
6. Add background watchers and leader election for multi-tab.
7. Add tests for conflict scenarios and offline rehydration.

## Next steps (immediate)

1. Add RxDB setup and JSON schemas (start of implementation).
2. Implement a minimal `yjs-adapter` to open a `Y.Doc` and persist updates to RxDB.

---
Created as the implementation blueprint for adding a cache layer using RxDB + Yjs CRDT.

# RxDB + Yjs Workspace Model Clarification

**Date:** Feb 25, 2026  
**Status:** Phase 1, Iteration 1 — Workspace model clarified and implemented

---

## Overview

The cache layer now implements a **workspace-type-aware** sync architecture:

- **Browser workspaces** (`workspaceType: 'browser'`) — Purely local, no sync needed
- **Local workspaces** (`workspaceType: 'local'`) — Synced via LocalAdapter
- **GDrive workspaces** (`workspaceType: 'gdrive'`) — Synced via GDriveAdapter
- **S3 workspaces** (`workspaceType: 's3'`) — Synced via S3Adapter (future)

---

## Changes Made

### 1. **Data Model Updated** (`src/core/cache/types.ts`)
- Added `workspaceType: 'browser' | 'local' | 'gdrive' | 's3'` to `CachedFile`
- `dirty` flag only applies to non-browser workspaces

### 2. **RxDB Schema Updated** (`src/core/cache/schemas.ts`)
- `workspaceType` is now a required field on `cached_files`
- Added indexes for efficient workspace filtering

### 3. **SyncManager Workspace-Aware** (`src/core/sync/sync-manager.ts`)
- Filters out browser workspace files during sync cycle
- Only processes files with `workspaceType !== 'browser'`
- Prevents unnecessary sync operations for local-only files

### 4. **Adapter Architecture Refined** (`src/core/sync/adapters/`)
- **Removed:** BrowserAdapter (no longer needed)
- **Deprecated:** browser-adapter.ts → throws error with migration guidance
- **Added:** S3Adapter stub for future implementation
- **Kept:** LocalAdapter, GDriveAdapter (ready for implementation)

### 5. **Documentation Updated**
- [RXDB_CRDT_ARCHITECTURE.md](../RXDB_CRDT_ARCHITECTURE.md) — Clarified workspace types
- [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) — Updated data flow diagrams
- [CACHE_QUICKSTART.md](../CACHE_QUICKSTART.md) — Added workspace examples

### 6. **UI Bridge Enhanced** (`src/features/editor/store/editor-cache-bridge.ts`)
- `useOpenFileForEditing()` now accepts `workspaceType` parameter
- Defaults to `'browser'` for backward compatibility

---

## Sync Flow (Revised)

### Browser Workspace Files
```
User edits
    ↓
Yjs Y.Doc
    ↓
RxDB (IndexedDB) ← STOPS HERE
    ↓
[No sync, file stays local]
```

### Local/GDrive/S3 Workspace Files
```
User edits
    ↓
Yjs Y.Doc
    ↓
RxDB (IndexedDB)
    ↓
SyncManager (filters by workspaceType)
    ↓
LocalAdapter / GDriveAdapter / S3Adapter
    ↓
Local FS / Google Drive / S3 Bucket
```

---

## Usage Example

### Opening a Browser Workspace File
```typescript
// Local-only, no sync
const { ydoc, isDirty } = useOpenFileForEditing('file-1', '/notes.md', 'browser');
// isDirty will always be false (browser workspace doesn't track dirty)
// No sync adapter will ever touch this file
```

### Opening a Local Workspace File
```typescript
// Synced to filesystem
const { ydoc, isDirty } = useOpenFileForEditing('file-2', '/docs/file.md', 'local');
// isDirty tracks unsync'd changes
// LocalAdapter will sync when dirty flag is set
```

### Opening a GDrive Workspace File
```typescript
// Synced to Google Drive
const { ydoc, isDirty } = useOpenFileForEditing('file-3', '/shared/doc.md', 'gdrive');
// isDirty tracks unsync'd changes
// GDriveAdapter will sync when dirty flag is set
```

---

## Adapter Registration

Only register adapters for workspaces you intend to support:

```typescript
import { initializeSyncManager } from '@/core/sync';
import { LocalAdapter, GDriveAdapter, S3Adapter } from '@/core/sync/adapters';

// Register adapters for supported workspace types
const syncMgr = await initializeSyncManager([
  new LocalAdapter(),           // For 'local' workspace files
  new GDriveAdapter(client),    // For 'gdrive' workspace files
  // new S3Adapter(bucket, region)  // For 's3' workspace files (future)
]);

// Browser workspace files are excluded from sync automatically
// SyncManager checks workspaceType before syncing
```

---

## Key Implementation Details

### SyncManager Filtering
```typescript
// In performSync():
const filesToSync = dirtyFiles.filter(f => f.workspaceType !== 'browser');
// Only local/gdrive/s3 files continue to sync
```

### File Creation Pattern
```typescript
// Always specify workspaceType when creating a file
const file: CachedFile = {
  id: 'file-1',
  name: 'note.md',
  path: '/notes.md',
  type: 'file',
  workspaceType: 'browser',  // ← Required
  dirty: false
};
```

### Browser vs Synced Workspaces

| Aspect | Browser | Local/GDrive/S3 |
|--------|---------|-----------------|
| **Storage** | IndexedDB only | IndexedDB + Remote |
| **Sync** | Never | Via adapter |
| **Dirty Flag** | Ignored | Tracks changes |
| **Offline** | All edits persist | Edits persist, sync on reconnect |
| **Adapter** | None | LocalAdapter, GDriveAdapter, or S3Adapter |

---

## Migration Notes

### For Existing Code
- No breaking changes for browser-only usage
- If only supporting browser workspaces, no adapter setup needed
- Default `workspaceType` is `'browser'`

### Adding Sync Support Later
1. Specify `workspaceType` when creating files (local, gdrive, s3)
2. Register appropriate adapters in SyncManager
3. Implement adapter methods (push, pull, delete)

### Removing BrowserAdapter
- Old BrowserAdapter code is deprecated and will throw
- Migration: Use S3Adapter for cloud storage, or leave browser-only

---

## Files Modified

- ✅ `src/core/cache/types.ts` — Added `WorkspaceType`
- ✅ `src/core/cache/schemas.ts` — Added `workspaceType` to schema
- ✅ `src/core/sync/sync-manager.ts` — Workspace-aware filtering
- ✅ `src/core/sync/adapters/index.ts` — Removed BrowserAdapter export
- ✅ `src/core/sync/adapters/browser-adapter.ts` — Deprecated
- ✅ `src/core/sync/adapters/s3-adapter.ts` — Created for future use
- ✅ `src/features/editor/store/editor-cache-bridge.ts` — Added workspaceType param
- ✅ `docs/RXDB_CRDT_ARCHITECTURE.md` — Updated
- ✅ `docs/IMPLEMENTATION_SUMMARY.md` — Updated
- ✅ `docs/CACHE_QUICKSTART.md` — Updated with workspace examples

---

## Build Status
✅ TypeScript compiles cleanly  
✅ No import errors  
✅ All exports correct

---

## Next Steps

1. **Implement LocalAdapter** — File I/O + filesystem watcher
2. **Implement GDriveAdapter** — Google Drive API integration
3. **Implement S3Adapter** — S3 SDK integration (can be deferred)
4. **Wire UI components** — Connect editor to useOpenFileForEditing
5. **Add E2E tests** — Test browser vs synced workspace behavior

---

Created to clarify and document the workspace-aware cache architecture.

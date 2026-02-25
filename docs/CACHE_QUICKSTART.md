# RxDB + Yjs CRDT Cache - Quick Start Guide

## What Was Built

A complete **offline-first cache layer** using RxDB + Yjs CRDT with SyncManager for seamless multi-adapter syncing (local, GDrive, browser).

**Status:** ✅ Phase 1 Complete — Core infrastructure ready for integration

---

## Quick Integration Steps

### 1. Initialize Cache on App Startup

```typescript
// app.tsx or main.tsx
import { useEditorCache } from '@/features/editor/store/editor-cache-bridge';

function App() {
  const { initialized, error } = useEditorCache();
  
  if (error) {
    return <ErrorBoundary error={error} />;
  }
  
  if (!initialized) {
    return <LoadingSpinner />;
  }
  
  return <MainApp />;
}
```

### 2. Open a File for Editing

```typescript
// In a file editor component
import { 
  useOpenFileForEditing, 
  useEditorSync,
  useDirtyFiles 
} from '@/features/editor/store/editor-cache-bridge';

function FileEditor({ fileId, filePath }) {
  // Load file with CRDT document
  const { ydoc, fileMetadata, isDirty } = useOpenFileForEditing(fileId, filePath);
  
  // Bind editor to Yjs document
  const { content, updateContent } = useEditorSync(fileId, ydoc);
  
  if (!ydoc) return <LoadingSpinner />;
  
  return (
    <div>
      <header>
        <h1>{fileMetadata?.name}</h1>
        {isDirty && <span className="unsaved">●</span>}
      </header>
      
      <textarea
        value={content}
        onChange={(e) => updateContent(e.target.value)}
        placeholder="Start typing..."
      />
    </div>
  );
}
```

### 3. Show File Tree from Cache

```typescript
import { useCachedFilesList } from '@/features/editor/store/editor-cache-bridge';

function FileTree() {
  const { files, loading } = useCachedFilesList();
  
  if (loading) return <div>Loading files...</div>;
  
  return (
    <ul>
      {files.map(file => (
        <li key={file.id}>
          {file.name}
          {file.dirty && <span className="unsaved">*</span>}
        </li>
      ))}
    </ul>
  );
}
```

### 4. Wire Up SyncManager (Background Sync)

```typescript
// In app initialization
import { initializeSyncManager } from '@/core/sync';
import { LocalAdapter, GDriveAdapter, BrowserAdapter } from '@/core/sync/adapters';

async function initializeSync() {
  const syncMgr = await initializeSyncManager([
    new LocalAdapter(),
    new GDriveAdapter(googleDriveClient),
    new BrowserAdapter('https://api.example.com/files')
  ]);
  
  // Display sync status in UI
  syncMgr.status$().subscribe(status => {
    console.log('Sync status:', status); // IDLE, SYNCING, ONLINE, OFFLINE, ERROR
  });
  
  // Monitor sync stats
  syncMgr.stats$().subscribe(stats => {
    console.log(`Synced: ${stats.totalSynced}, Failed: ${stats.totalFailed}`);
  });
}
```

### 5. Add Sync Status Indicator

```typescript
import { getSyncManager } from '@/core/sync';

function SyncStatusBar() {
  const [status, setStatus] = useState('idle');
  
  useEffect(() => {
    const sub = getSyncManager().status$().subscribe(setStatus);
    return () => sub.unsubscribe();
  }, []);
  
  const icons = {
    idle: '⊙',
    syncing: '↻',
    online: '✓',
    offline: '✗',
    error: '⚠'
  };
  
  return <div className="sync-status">{icons[status]}</div>;
}
```

---

## Architecture

```
React Component (Editor)
    ↓ (useOpenFileForEditing, useEditorSync)
    ↓
┌─────────────────────┐
│   Yjs Y.Doc         │ ← Collaborative text editing
│ (auto-persists)     │
└─────────────────────┘
    ↓ (updates)
┌─────────────────────────┐
│   RxDB (IndexedDB)      │ ← Offline-first cache
│  ✓ cached_files         │
│  ✓ crdt_docs           │
└─────────────────────────┘
    ↓ (watches dirty files)
┌─────────────────────────┐
│   SyncManager           │ ← Orchestrates multi-adapter sync
│  ✓ Push to adapters     │
│  ✓ Pull & merge         │
│  ✓ Retry on failure     │
└──────┬────┬────┬────────┘
   ┌───┴───┐ │    └─────────────┐
   ▼       ▼ ▼                  ▼
┌─────┐ ┌──────┐ ┌────────────────┐
│Local│ │GDrive│ │Browser (HTTP)  │
└─────┘ └──────┘ └────────────────┘
   ↓       ↓           ↓
 Local FS  Google Drive  Remote API
```

---

## Key Concepts

### CRDT (Conflict-free Replicated Data Type)
- **What:** Yjs + text data type handles concurrent edits automatically
- **Why:** No manual conflict resolution needed; deterministic merging
- **Example:** Alice and Bob edit different parts of same doc → both changes preserved

### Offline-First
- All changes stored in **IndexedDB** (device-side)
- Works completely offline
- Syncs to remote when connection returns
- No data loss if browser closes

### Adapters
- **LocalAdapter:** Electron file system (TODO)
- **GDriveAdapter:** Google Drive API (TODO)
- **BrowserAdapter:** HTTP backend / WebSocket (TODO)

### SyncManager
- Polls dirty files every 5 seconds (configurable)
- Tries each adapter until one succeeds
- Applies remote changes with automatic CRDT merge
- Retries with exponential backoff on failure
- Multi-tab support via leader election

### Dirty Flag
- Set when file is modified locally
- Cleared after successful sync
- Prevents redundant uploads

---

## Testing the Cache Layer

### Quick Manual Test

```typescript
// In browser console:
import { 
  initializeRxDB, 
  createOrLoadYjsDoc, 
  getYjsText 
} from 'src/core/cache';

// Initialize
await initializeRxDB();

// Create a new doc
const ydoc = await createOrLoadYjsDoc({ crdtId: 'test', initialContent: 'Hello' });

// Verify content
console.log(getYjsText(ydoc)); // "Hello"

// Close browser, reopen — persisted!
```

### Monitor Sync Manager

```typescript
import { getSyncManager } from 'src/core/sync';

const mgr = getSyncManager();
mgr.status$().subscribe(s => console.log('Status:', s));
mgr.stats$().subscribe(st => console.log('Stats:', st));
```

---

## Files Added/Modified

### New Files
```
✓ src/core/cache/
  ├── index.ts
  ├── types.ts
  ├── schemas.ts
  ├── rxdb.ts
  └── yjs-adapter.ts

✓ src/core/sync/
  ├── index.ts
  ├── sync-manager.ts
  └── adapters/
      ├── index.ts
      ├── local-adapter.ts
      ├── gdrive-adapter.ts
      └── browser-adapter.ts

✓ src/features/editor/store/
  └── editor-cache-bridge.ts

✓ docs/
  ├── RXDB_CRDT_ARCHITECTURE.md
  └── IMPLEMENTATION_SUMMARY.md
```

### Dependencies Added
```json
{
  "rxdb": "^14.13.0",
  "yjs": "^13.6.8",
  "rxjs": "^7.8.2",
  "dexie": "^4.3.0"
}
```

---

## What's Next

### Phase 2: Adapter Implementations
- [ ] `LocalAdapter` — File I/O + filesystem watcher
- [ ] `GDriveAdapter` — Google Drive API integration
- [ ] `BrowserAdapter` — HTTP & WebSocket support

### Phase 3: UI Integration
- [ ] Wire editor component to cache hooks
- [ ] Show unsaved indicators
- [ ] Sync status bar
- [ ] Conflict resolution UI (if needed)

### Phase 4: Advanced Features
- [ ] File history/versioning
- [ ] Selective sync
- [ ] Large file support
- [ ] Change auditing

### Phase 5: Testing & Docs
- [ ] Unit tests (cache operations)
- [ ] E2E tests (offline sync)
- [ ] Migration guide
- [ ] Troubleshooting docs

---

## Troubleshooting

### Cache not persisting across reloads?
- Ensure `useEditorCache()` is called on app startup
- Check browser IndexedDB: DevTools → Application → IndexedDB → verve_cache_db

### Sync not working?
- Verify adapters are registered: `getSyncManager().adapters`
- Check console logs for errors during sync cycle
- Manually trigger: `getSyncManager().syncNow()`

### Yjs conflicts?
- Yjs handles automatically — no manual intervention needed
- Check merged state in RxDB after sync

### Performance issues?
- Reduce sync interval: `new SyncManager(batchSize, syncInterval)`
- Monitor RxDB size in DevTools
- Consider archiving old files

---

## References

- [RxDB Docs](https://rxdb.info/)
- [Yjs Docs](https://docs.yjs.dev/)
- [CRDT Introduction](https://crdt.tech/)
- [RxJS Observables](https://rxjs.dev/)

---

## Architecture Overview

[See IMPLEMENTATION_SUMMARY.md for detailed architecture & diagrams](./IMPLEMENTATION_SUMMARY.md)

---

**Ready to integrate!** Start with steps 1-3 above for a basic editor with offline support.

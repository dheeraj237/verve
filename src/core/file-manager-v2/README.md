# File Manager V2

A unified, adapter-based file management system for seamless editing across different workspace types (Browser/Demo, Local, Google Drive).

## Architecture

```
FileManager (Orchestrator)
├── FileCache (In-memory with LRU)
├── SyncQueue (Background sync with retry)
└── WorkspaceAdapter (Pluggable backends)
    ├── DemoAdapterV2
    ├── LocalAdapterV2
    └── GoogleDriveAdapterV2
```

## Key Features

- **Unified API**: Single interface for all file operations
- **Optimistic Updates**: Instant UI feedback with background sync
- **Smart Caching**: LRU cache with dirty state tracking
- **Reliable Sync**: Queue-based sync with retry logic and debouncing
- **Type-Safe**: Full TypeScript support
- **Extensible**: Easy to add new adapters

## Usage

### Basic Setup

```typescript
import { FileManager, DemoAdapterV2 } from '@/core/file-manager-v2';

// Create adapter
const adapter = new DemoAdapterV2();
await adapter.initialize();

// Create file manager
const fileManager = new FileManager(adapter);
```

### File Operations

```typescript
// Read file
const file = await fileManager.loadFile('/path/to/file.md');
console.log(file.content);

// Update file (optimistic + background sync)
await fileManager.updateFile('/path/to/file.md', 'new content');

// Create file
await fileManager.createFile('/new-file.md', 'initial content');

// Delete file
await fileManager.deleteFile('/path/to/file.md');

// Rename file
await fileManager.renameFile('/old.md', '/new.md');

// List files
const files = await fileManager.listFiles('/directory');
```

### Switching Workspaces

```typescript
import { GoogleDriveAdapterV2 } from '@/core/file-manager-v2';

// Create new adapter
const driveAdapter = new GoogleDriveAdapterV2(
  () => requestDriveAccessToken(false),
  'folderId'
);

// Switch adapter (flushes pending operations)
await fileManager.switchAdapter(driveAdapter, true);
```

### Monitoring Sync Status

```typescript
// Get sync status
const status = fileManager.getSyncStatus();
console.log({
  pending: status.pending,
  processing: status.processing,
  failed: status.failed,
});

// Subscribe to changes
const unsubscribe = fileManager.subscribeSyncStatus((status) => {
  console.log('Sync status changed:', status);
});

// Cleanup
unsubscribe();
```

### Cache Management

```typescript
// Get cache stats
const stats = fileManager.getCacheStats();
console.log({
  size: stats.size,
  hitRate: stats.hitRate,
  memoryUsage: stats.memoryUsage,
});

// Invalidate specific file
fileManager.invalidateCache('/path/to/file.md');

// Force sync a file
await fileManager.forceSync('/path/to/file.md');
```

## Adapters

### Demo Adapter

Browser-based storage using localStorage:

```typescript
import { DemoAdapterV2 } from '@/core/file-manager-v2';

const adapter = new DemoAdapterV2();
await adapter.initialize(); // Loads sample files
```

### Local Adapter

File System Access API for local files:

```typescript
import { LocalAdapterV2 } from '@/core/file-manager-v2';

const adapter = new LocalAdapterV2();

// Request directory access
const dirHandle = await window.showDirectoryPicker();
await adapter.initialize(dirHandle);
```

### Google Drive Adapter

Google Drive API v3 integration:

```typescript
import { GoogleDriveAdapterV2 } from '@/core/file-manager-v2';

const adapter = new GoogleDriveAdapterV2(
  () => requestDriveAccessToken(false), // Token getter
  'folderId' // Root folder ID
);
```

## Configuration

### Debounce Timers

```typescript
import { DEBOUNCE_CONFIG } from '@/core/file-manager-v2';

// Default values in constants.ts:
{
  autoSave: 2000,  // 2s for auto-save
  userSave: 0,     // Immediate for Cmd+S
  create: 100,     // 100ms for new files
  delete: 0,       // Immediate
  rename: 0,       // Immediate
}
```

### Retry Policy

```typescript
import { RETRY_CONFIG } from '@/core/file-manager-v2';

// Default values:
{
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
}
```

### Cache Limits

```typescript
import { CACHE_CONFIG } from '@/core/file-manager-v2';

// Default values:
{
  maxSize: 100,                    // Max cached files
  maxMemory: 50 * 1024 * 1024,    // 50MB
  ttl: 5 * 60 * 1000,             // 5 minutes
}
```

## Error Handling

```typescript
import { FileSystemError, FileErrorType } from '@/core/file-manager-v2';

try {
  await fileManager.loadFile('/missing.md');
} catch (error) {
  if (error instanceof FileSystemError) {
    switch (error.type) {
      case FileErrorType.NOT_FOUND:
        console.log('File not found');
        break;
      case FileErrorType.PERMISSION_DENIED:
        console.log('Permission denied');
        break;
      case FileErrorType.NETWORK_ERROR:
        // Retryable error
        if (error.retryable) {
          console.log('Will retry automatically');
        }
        break;
    }
  }
}
```

## Integration with Stores

```typescript
import { getFileManager, switchFileManager } from '@/core/store/file-manager-integration';
import { useWorkspaceStore } from '@/core/store/workspace-store';

// Get file manager instance
const workspace = useWorkspaceStore.getState().activeWorkspace();
const fileManager = getFileManager(workspace);

// Switch workspace
const newWorkspace = { type: 'drive', driveFolder: 'folderId', ... };
await switchFileManager(newWorkspace);
```

## Performance

Target metrics:
- Cache hit: < 1ms
- Cache miss: < 100ms  
- Optimistic update: < 5ms
- Sync to adapter: < 500ms (local), < 2s (Drive)
- Workspace switch: < 1s

## Testing

```typescript
// Mock adapter for testing
class MockAdapter implements WorkspaceAdapter {
  type = WorkspaceType.DEMO;
  capabilities = { ... };
  
  async readFile(path: string) { return mockFile; }
  async writeFile(path: string, content: string) { }
  // ...
}

const adapter = new MockAdapter();
const fileManager = new FileManager(adapter);
```

## Migration from V1

File Manager V2 is designed as a drop-in replacement for V1. Key differences:

- **Unified interface**: All workspace types use the same API
- **Optimistic updates**: UI updates immediately, sync happens in background
- **Better caching**: Smarter eviction and dirty state tracking
- **Reliable sync**: Queue-based with retry logic
- **Type safety**: Better TypeScript support

## Future Enhancements

- Pull-based sync (detect external changes)
- Conflict resolution UI
- Batch operations
- Real-time collaboration
- Web Worker for heavy operations

## License

MIT

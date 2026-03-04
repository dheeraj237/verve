# FileNode Unified Type Refactor - Architecture & Implementation Plan

**Status:** Planning Phase  
**Date Created:** March 4, 2026  
**Last Updated:** March 4, 2026

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [New Unified Architecture](#new-unified-architecture)
4. [Sync Bridge Pattern](#sync-bridge-pattern)
5. [Type Definitions](#type-definitions)
6. [Data Flow](#data-flow)
7. [Implementation Phases](#implementation-phases)
8. [Task Breakdown & Dependencies](#task-breakdown--dependencies)
9. [Verification Checklist](#verification-checklist)
10. [Risk Mitigation](#risk-mitigation)

---

## Executive Summary

This refactor consolidates four distinct file type representations (FileNode, FileDoc, CachedFile, MarkdownFile) into a single, standardized **FileNode** type used across all layers: UI components, stores, RxDB persistence, and sync operations.

**Goals:**
- Unified type management across all UI components, stores, and persistence layer
- RxDB-compatible schema supporting file hierarchy, CRUD, search, and queries
- Editor-like performance through lazy-loaded content and optimized indexes
- Type-safe sync operations with dedicated bridge between adapters and canonical FileNode format
- Eliminate type conversions and manual mapping throughout the codebase

**Key Metrics:**
- **Lines of code reduced:** ~500-1000 (type converters, mappers, duplicated logic)
- **Type safety improved:** Single source of truth eliminates conversion errors
- **Performance:** Lazy-loading content reduces memory footprint; RxDB indexes enable fast queries

---

## Current State Analysis

### Existing File Type Landscape

```typescript
/* CURRENT FRAGMENTATION */

// 1. FileNode - UI Tree Structure (src/shared/types/index.ts)
interface FileNode {
  id: string;
  name: string;
  path: string;
  type: FileNodeType;           // 'file' | 'folder'
  children?: FileNode[];         // Nested objects for tree UI
}

// 2. FileDoc - RxDB Persistence (src/core/rxdb/schemas.ts)
interface FileDoc {
  id: string;
  workspaceId: string;
  workspaceType: WorkspaceType;
  type: FileType;                // 'file' | 'directory'
  path: string;
  name: string;
  content: string;               // FULL CONTENT STORED
  dirty: boolean;
  lastModified: number;
  size?: number;
  mimeType?: string;
  syncStatus?: SyncStatus;
  version?: number;
}

// 3. CachedFile - Bridge Type (src/core/cache/types.ts)
type CachedFile = {
  id: string;
  name: string;
  path: string;
  type: FileType;
  workspaceType: WorkspaceType;
  workspaceId?: string;
  content?: string;              // Optional
  size?: number;
  modifiedAt?: string;
  children?: string[];           // ID ARRAY not nested objects
  parentId?: string;
  dirty?: boolean;
  isSynced?: boolean;
  version?: number;
};

// 4. MarkdownFile - Editor Tabs (src/shared/types/index.ts)
interface MarkdownFile {
  id: string;
  path: string;
  name: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  fileHandle?: FileSystemFileHandle;
  isLocal?: boolean;
  isExternalUpdate?: boolean;
  lastSaved?: Date;
  isSaving?: boolean;
  category: FileCategory;        // Separate enum
}
```

### Problems with Current Approach

| Issue | Impact | Example |
|-------|--------|---------|
| **Type Proliferation** | Cognitive load, conversion logic scattered | FileNode → CachedFile → FileDoc conversions in 5+ places |
| **Enum Inconsistency** | Type safety issues | `FileNodeType.Folder` vs `FileType.Dir` vs `FileCategory.Local` |
| **Content Storage** | Memory overhead | Full content in every FileDoc even when not needed |
| **Child Representation** | UI/sync mismatch | FileNode uses nested objects, CachedFile uses ID arrays |
| **No String Type Safety** | Sync issues | `syncStatus?: string` allows arbitrary values |
| **Duplicate Metadata** | Data drift | Same file has `modifiedAt` (string) AND `lastModified` (number) |
| **Workspace Tracking** | Scattered responsibility | Some types track `workspaceId`, others don't |

### Data Flow Issues

```
Remote Adapter (GDrive, Local, S3)
    ↓ (AdapterEntry)
adapter-normalize.ts (manual conversion)
    ↓ (CachedFile → FileDoc casting)
RxDB Cache Layer
    ↓ (manual tree building)
file-explorer-store (_buildFileTreeFromCache)
    ↓ (FileNode tree)
UI Components
    ↓
Editor Store (transforms to MarkdownFile)
    ↓ (separate type)
CodeMirror
```

**Problems:** 4 type transformations, no centralized conversion logic, error-prone manual mapping.

---

## New Unified Architecture

### Single FileNode Type (Canonical)

```typescript
// src/shared/types/index.ts - NEW UNIFIED DEFINITION
export interface FileNode {
  // ========== CORE IDENTITY ==========
  id: string;                        // Unique identifier (workspace-scoped)
  path: string;                      // '/parent/child/file.md' (workspace root relative)
  name: string;                      // 'file.md'
  
  // ========== TYPE & HIERARCHY ==========
  type: FileType;                    // 'file' | 'directory'
  parentId?: string | null;          // Parent directory ID (null for root)
  children?: FileNode[];             // Nested objects for UI tree rendering
  
  // ========== CONTENT (LAZY-LOADED) ==========
  content?: string;                  // Omitted by default, loaded on demand
  contentHash?: string;              // SHA-256 hash for change detection
  
  // ========== METADATA ==========
  size?: number;                     // File size in bytes
  mimeType?: string;                 // 'text/markdown', 'application/json', etc.
  
  // ========== TIMESTAMPS (NORMALIZED) ==========
  createdAt?: string;                // ISO 8601 timestamp
  modifiedAt?: string;               // ISO 8601 timestamp (canonical, used everywhere)
  
  // ========== WORKSPACE CONTEXT ==========
  workspaceId: string;               // Which workspace this file belongs to
  workspaceType: WorkspaceType;      // 'browser' | 'local' | 'gdrive' | 's3'
  
  // ========== SYNC STATE ==========
  dirty: boolean;                    // Has unsaved changes
  isSynced: boolean;                 // Successfully synced to remote
  syncStatus: 'idle' | 'syncing' | 'conflict' | 'error';
  version: number;                   // Conflict detection & merge
  
  // ========== EDITOR SUPPORT ==========
  isLocal?: boolean;                 // Opened via File System Access API
  fileHandle?: FileSystemFileHandle; // Browser File System API handle
}

// src/core/cache/types.ts
export enum FileType {
  File = 'file',
  Directory = 'directory',
}

export enum WorkspaceType {
  Browser = 'browser',
  Local = 'local',
  GDrive = 'gdrive',
  S3 = 's3',
}
```

### RxDB Schema Update

```typescript
// src/core/rxdb/schemas.ts
export const fileNodeSchema: RxJsonSchema<FileNode> = {
  title: 'FileNode',
  version: 2,
  primaryKey: 'id',
  type: 'object',
  properties: {
    // Indexed fields for performance
    id: { type: 'string' },
    workspaceId: { type: 'string' },
    path: { type: 'string' },
    type: { enum: ['file', 'directory'] },
    dirty: { type: 'boolean' },
    syncStatus: { enum: ['idle', 'syncing', 'conflict', 'error'] },
    
    // Non-indexed, stored separately if needed
    content: { type: 'string' },
    contentHash: { type: 'string' },
    
    // Metadata
    name: { type: 'string' },
    parentId: { type: ['string', 'null'] },
    size: { type: 'number' },
    mimeType: { type: 'string' },
    createdAt: { type: 'string' },
    modifiedAt: { type: 'string' },
    
    // Sync fields
    isSynced: { type: 'boolean' },
    version: { type: 'number' },
    workspaceType: { enum: ['browser', 'local', 'gdrive', 's3'] },
    
    // Editor support
    isLocal: { type: 'boolean' },
  },
  indexes: [
    ['workspaceId'],              // Fast: files in a workspace
    ['workspaceId', 'path'],      // Fast: find by path in workspace
    ['workspaceId', 'type'],      // Fast: list directories only
    ['workspaceId', 'dirty'],     // Fast: find unsaved changes
    ['workspaceId', 'syncStatus'], // Fast: find syncing/conflicted
  ],
};
```

---

## Sync Bridge Pattern

### Overview

The **sync-bridge** is a dedicated layer that orchestrates conversions between:
- **FileNode** (canonical internal format)
- **AdapterEntry/AdapterDescriptor** (external adapter formats)

This decouples adapters from FileNode type, making both independently testable and evolvable.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYNC OPERATIONS                           │
└─────────────────────────────────────────────────────────────────┘

                            handle-sync.ts
                                 │
                  ┌──────────────┬┴┬──────────────┐
                  │                               │
            PULL FLOW                        PUSH FLOW
                  │                               │
         ┌────────▼─────────┐           ┌────────▼─────────┐
         │ Adapter.pull()   │           │ queryDirtyFiles()│
         │ Returns:         │           │ Returns:         │
         │ AdapterEntry[]   │           │ FileNode[]       │
         └────────┬─────────┘           │ (dirty=true)     │
                  │                     └────────┬─────────┘
                  │                              │
         ┌────────▼──────────────────────────────▼────────┐
         │     file-node-bridge.ts (Converter)            │
         │                                                 │
         │ ┌─────────────────────────────────────────┐   │
         │ │ Pull: adapterResponseToFileNode()       │   │
         │ │ ├─ GDrive metadata → FileNode          │   │
         │ │ ├─ Local FS stat → FileNode            │   │
         │ │ └─ S3 object metadata → FileNode       │   │
         │ └─────────────────────────────────────────┘   │
         │                                                 │
         │ ┌─────────────────────────────────────────┐   │
         │ │ Push: fileNodeToAdapterDescriptor()     │   │
         │ │ ├─ FileNode → GDrive metadata          │   │
         │ │ ├─ FileNode → Local FS path+content    │   │
         │ │ └─ FileNode → S3 key+metadata          │   │
         │ └─────────────────────────────────────────┘   │
         └────────┬──────────────────────────────┬────────┘
                  │                              │
         ┌────────▼─────────┐           ┌────────▼─────────┐
         │ FileNode[]       │           │ AdapterDesc[]    │
         │ (no content)     │           │ (with content)   │
         │                  │           │                  │
         │ ↓                │           │ ↓                │
         │ file-manager     │           │ Adapter.push()   │
         │ .saveFileNode()  │           │ Updates remote   │
         │                  │           │                  │
         │ ↓                │           │ ↓                │
         │ RxDB persisted   │           │ Mark as synced   │
         └──────────────────┘           └──────────────────┘
```

### Pull Operation (Remote → Local)

```typescript
// src/core/rxdb/handle-sync.ts
async function _pullFromAdapter(
  adapter: Adapter,
  workspaceId: string
): Promise<FileNode[]> {
  // 1. Get changes from remote
  const { entries, deletions } = await adapter.pullChanges({
    since: lastSyncToken,
  });
  
  // 2. Convert adapter entries to FileNode (no content yet)
  const fileNodes = fileBridge.adapterResponseToFileNode(
    entries,
    adapter.type,
    workspaceId
  );
  
  // 3. Persist to RxDB
  for (const fileNode of fileNodes) {
    await fileManager.saveFileNode(fileNode);
  }
  
  // 4. Handle deletions
  for (const deletedId of deletions) {
    await fileManager.deleteFileNode(deletedId);
  }
  
  return fileNodes;
}
```

### Push Operation (Local → Remote)

```typescript
// src/core/rxdb/handle-sync.ts
async function _pushToAdapter(
  adapter: Adapter,
  workspaceId: string
): Promise<FileNode[]> {
  // 1. Get all dirty files
  const dirtyFiles = await fileManager.queryDirtyFiles(workspaceId);
  
  // 2. For files with content, load it
  const filesWithContent = await Promise.all(
    dirtyFiles.map(async (file) => {
      if (file.type === FileType.File && !file.content) {
        return fileManager.getFileNodeWithContent(file.id);
      }
      return file;
    })
  );
  
  // 3. Convert FileNode to adapter format
  const adapterDescriptors = fileBridge.fileNodeToAdapterDescriptor(
    filesWithContent,
    adapter.type
  );
  
  // 4. Push to remote
  await adapter.pushChanges(adapterDescriptors);
  
  // 5. Mark as synced
  for (const file of dirtyFiles) {
    file.dirty = false;
    file.isSynced = true;
    file.syncStatus = 'idle';
    await fileManager.saveFileNode(file);
  }
  
  return dirtyFiles;
}
```

---

## Type Definitions

### New Unified FileNode

**Location:** index.ts

```typescript
export interface FileNode {
  // Identity (required)
  id: string;
  path: string;
  name: string;
  
  // Type & Hierarchy (required)
  type: FileType;
  parentId?: string | null;
  children?: FileNode[];
  
  // Content (lazy-loaded)
  content?: string;
  contentHash?: string;
  
  // Metadata (optional)
  size?: number;
  mimeType?: string;
  createdAt?: string;
  modifiedAt?: string;
  
  // Workspace Context (required)
  workspaceId: string;
  workspaceType: WorkspaceType;
  
  // Sync State (required)
  dirty: boolean;
  isSynced: boolean;
  syncStatus: 'idle' | 'syncing' | 'conflict' | 'error';
  version: number;
  
  // Editor Support (optional)
  isLocal?: boolean;
  fileHandle?: FileSystemFileHandle;
}
```

### Adapter Interface (Unchanged)

**Location:** adapter-types.ts

Adapters continue to return their native formats; conversion happens in bridge:

```typescript
export interface AdapterEntry {
  id?: string;
  path: string;
  metadata?: Record<string, any>;
  modifiedTime?: number;
}

export interface AdapterFileDescriptor {
  id?: string;
  path: string;
  content?: string;
  metadata?: Record<string, any>;
}
```

### Sync Bridge Interface (New)

**Location:** `src/core/sync/file-node-bridge.ts`

```typescript
export class FileNodeBridge {
  /**
   * Convert remote adapter response to FileNode (no content)
   */
  adapterResponseToFileNode(
    entries: AdapterEntry[],
    adapterType: AdapterType,
    workspaceId: string
  ): FileNode[];
  
  /**
   * Convert FileNode to adapter push format
   */
  fileNodeToAdapterDescriptor(
    files: FileNode[],
    adapterType: AdapterType
  ): AdapterFileDescriptor[];
  
  /**
   * Single entry conversion (for testing)
   */
  convertAdapterEntry(
    entry: AdapterEntry,
    adapterType: AdapterType,
    workspaceId: string
  ): FileNode;
}
```

---

## Data Flow

### NEW UNIFIED DATA FLOW

```
┌────────────────────────────────────────────────────────────────────┐
│                    UNIFIED FILENODE DATA FLOW                       │
└────────────────────────────────────────────────────────────────────┘

Remote Sources (GDrive, Local FS, S3, etc.)
    │
    ├─ PULL ────→ Adapter.pullChanges()
    │            Returns: AdapterEntry[]
    │            │
    ├────────────→ file-node-bridge.adapterResponseToFileNode()
    │            Returns: FileNode[] (no content)
    │            │
    ├────────────→ file-manager.saveFileNode()
    │            Persists to RxDB
    │            │
    ├────────────→ RxDB Collection (fileNodes indexed by workspace+path)
    │            │
    ├────────────→ file-explorer-store.getWorkspaceTree()
    │            Returns: FileNode tree (nested children)
    │            │
    ├────────────→ file-explorer UI Components
    │            └─ Renders FileNode tree directly
    │            │
    └────────────→ editor-store.openFile(fileNode)
                 ├─ Calls file-manager.getFileNodeWithContent()
                 ├─ Loads content from RxDB
                 └─ Updates state: openTabs: FileNode[]

Reverse for PUSH:
    │
    ├─ Dirty Files ──→ file-manager.queryDirtyFiles()
    │                 Returns: FileNode[] (dirty=true)
    │
    ├────────────────→ file-manager.getFileNodeWithContent()
    │                 Loads content if needed
    │
    ├────────────────→ file-node-bridge.fileNodeToAdapterDescriptor()
    │                 Returns: AdapterFileDescriptor[]
    │
    ├────────────────→ Adapter.pushChanges()
    │                 Updates remote
    │
    └────────────────→ file-manager.updateSync()
                      Sets dirty=false, isSynced=true
                      Persists to RxDB
```

---

## Implementation Phases

### Phase 1: Type Definitions & Schema (Weeks 1-1.5)
- [ ] Define unified FileNode interface
- [ ] Create RxDB schema
- [ ] Update TypeScript configs
- **Blocking:** None
- **Blocks:** All other phases

### Phase 2: RxDB & Cache Layer (Weeks 1.5-3)
- [ ] Implement new file-manager API
- [ ] Create file-node-bridge converter
- [ ] Update RxDB collections
- **Blocking:** Phase 1
- **Blocks:** Phase 3, 4

### Phase 3: Sync Operations (Weeks 3-4)
- [ ] Refactor pull operations
- [ ] Refactor push operations
- [ ] Update sync manager
- **Blocking:** Phase 2
- **Blocks:** Phase 5

### Phase 4: Store Layer (Weeks 2.5-3.5)
- [ ] Refactor file-explorer-store
- [ ] Refactor editor-store
- [ ] Update workspace-store
- **Blocking:** Phase 2
- **Blocks:** Phase 5

### Phase 5: UI Components (Weeks 3.5-5)
- [ ] Update file-explorer components
- [ ] Update editor components
- [ ] Update utilities
- **Blocking:** Phase 4
- **Blocks:** Testing phase

### Phase 6: Tests & Docs (Weeks 5-6)
- [ ] Create sync-bridge tests
- [ ] Update file-manager tests
- [ ] Update integration tests
- [ ] Update ARCHITECTURE.md
- **Blocking:** All phases
- **Blocks:** Merge/deploy

---

## Task Breakdown & Dependencies

### PHASE 1: Type Definitions & Schema

#### Task 1.1: Create unified FileNode interface
**File:** index.ts  
**Effort:** 2 hours  
**Dependencies:** None  

```typescript
// Add to src/shared/types/index.ts
export enum FileType {
  File = 'file',
  Directory = 'directory',
}

export enum WorkspaceType {
  Browser = 'browser',
  Local = 'local',
  GDrive = 'gdrive',
  S3 = 's3',
}

export interface FileNode {
  // [see Type Definitions section above]
}

// Backward compat aliases (deprecated)
export type FileDoc = FileNode;
export type CachedFile = FileNode;
export type MarkdownFile = FileNode;
```

**Testing:** Verify types compile, no circular dependencies

---

#### Task 1.2: Update RxDB schema
**File:** schemas.ts  
**Effort:** 4 hours  
**Dependencies:** Task 1.1  

- Update `fileSchema` to match FileNode interface
- Add/update indexes: `workspaceId`, `[workspaceId, path]`, `[workspaceId, type]`, `[workspaceId, dirty]`
- Update migration strategy if schema version changes
- Handle `content` field (optional, not indexed)

**Testing:** 
- Schema compiles with RxDB types
- Collection creation succeeds in test

---

#### Task 1.3: Update cache types file
**File:** types.ts  
**Effort:** 1 hour  
**Dependencies:** Task 1.1  

- Export FileType, WorkspaceType from shared types
- Remove duplicate enums
- Add deprecated type aliases for backward compat

**Testing:** No breaking imports in codebase

---

### PHASE 2A: File Manager API

#### Task 2A.1: Implement new file-manager methods
**File:** file-manager.ts  
**Effort:** 8 hours  
**Dependencies:** Task 1.2  

**New Methods:**
- `getFileNode(id: string): Promise<FileNode | null>` - no content
- `getFileNodeWithContent(id: string): Promise<FileNode | null>` - with content
- `saveFileNode(file: FileNode): Promise<FileNode>` - atomic upsert
- `queryByPath(workspaceId, prefix): Promise<FileNode[]>` - path prefix query
- `queryByName(workspaceId, pattern): Promise<FileNode[]>` - name pattern query
- `queryDirtyFiles(workspaceId): Promise<FileNode[]>` - sync candidates
- `getWorkspaceTree(workspaceId): Promise<FileNode>` - root with nested children
- `deleteFileNode(id: string): Promise<void>` - cascade delete for dirs
- `updateSyncStatus(id, status, version): Promise<FileNode>` - post-sync updates

**Implementation Notes:**
- Use RxDB collection.find() with indexes
- Lazy-load content only in `getFileNodeWithContent()`
- Use `contentHash` for change detection
- Atomic upsert pattern for conflict prevention

**Testing:**
- Unit tests for each method
- Async/await patterns work correctly
- RxDB indexes used effectively

---

#### Task 2A.2: Keep old API as deprecated wrappers (optional)
**File:** file-manager.ts  
**Effort:** 3 hours  
**Dependencies:** Task 2A.1  

Wrap old methods (getFile, loadFile, saveFile) → new API for backward compatibility during migration

**Testing:** Old API still works but logs deprecation warnings

---

### PHASE 2B: Sync Bridge Layer

#### Task 2B.1: Create FileNodeBridge class
**File:** `src/core/sync/file-node-bridge.ts` (NEW)  
**Effort:** 6 hours  
**Dependencies:** Task 1.1, Task 1.2  

```typescript
export class FileNodeBridge {
  adapterResponseToFileNode(
    entries: AdapterEntry[],
    adapterType: AdapterType,
    workspaceId: string
  ): FileNode[] {
    return entries.map(entry =>
      this.convertAdapterEntry(entry, adapterType, workspaceId)
    );
  }
  
  fileNodeToAdapterDescriptor(
    files: FileNode[],
    adapterType: AdapterType
  ): AdapterFileDescriptor[] {
    // Route to adapter-specific converter
    const converter = this.getConverter(adapterType);
    return files.map(file => converter.toAdapterDescriptor(file));
  }
  
  private convertAdapterEntry(
    entry: AdapterEntry,
    adapterType: AdapterType,
    workspaceId: string
  ): FileNode {
    const converter = this.getConverter(adapterType);
    return converter.fromAdapterEntry(entry, workspaceId);
  }
  
  private getConverter(type: AdapterType): AdapterConverter { ... }
}
```

**Testing:**
- Unit tests for each converter
- Mock adapter entries for GDrive, Local FS, S3
- Verify FileNode fields populated correctly

---

#### Task 2B.2: Create adapter-specific converters (modular)
**Files:** `src/core/sync/converters/` (NEW directory)  
**Effort:** 8 hours  
**Dependencies:** Task 1.1  

Files:
- `gdrive-converter.ts` - GDrive metadata ↔ FileNode
- `local-fs-converter.ts` - Local FS stat ↔ FileNode
- `s3-converter.ts` - S3 object metadata ↔ FileNode
- `browser-converter.ts` - Browser API ↔ FileNode

Each implements `AdapterConverter` interface:
```typescript
interface AdapterConverter {
  fromAdapterEntry(entry: AdapterEntry, workspaceId: string): FileNode;
  toAdapterDescriptor(file: FileNode): AdapterFileDescriptor;
}
```

**Testing:**
- Unit tests for each converter
- Test edge cases (special chars in paths, large files, etc.)
- Test round-trip: entry → FileNode → descriptor

---

### PHASE 3: Sync Operations

#### Task 3.1: Refactor pull operation
**File:** handle-sync.ts  
**Effort:** 5 hours  
**Dependencies:** Task 2A.1, Task 2B.1  

```typescript
async _pullFromAdapter(adapter: Adapter, workspaceId: string): Promise<FileNode[]> {
  const { entries, deletions } = await adapter.pullChanges({...});
  
  // Convert to FileNode
  const fileNodes = this.fileBridge.adapterResponseToFileNode(
    entries,
    adapter.type,
    workspaceId
  );
  
  // Persist
  for (const fn of fileNodes) {
    await this.fileManager.saveFileNode(fn);
  }
  
  // Handle deletions
  for (const id of deletions) {
    await this.fileManager.deleteFileNode(id);
  }
  
  return fileNodes;
}
```

**Testing:**
- Integration test: mock adapter pull → FileNode → RxDB
- Verify nested children rebuilt correctly
- Verify deletions cascade for directories

---

#### Task 3.2: Refactor push operation
**File:** handle-sync.ts  
**Effort:** 5 hours  
**Dependencies:** Task 2A.1, Task 2B.1  

```typescript
async _pushToAdapter(adapter: Adapter, workspaceId: string): Promise<FileNode[]> {
  // Get dirty files
  const dirtyFiles = await this.fileManager.queryDirtyFiles(workspaceId);
  
  // Load content if needed
  const filesWithContent = await Promise.all(
    dirtyFiles.map(f =>
      f.type === FileType.File && !f.content
        ? this.fileManager.getFileNodeWithContent(f.id)
        : Promise.resolve(f)
    )
  );
  
  // Convert to adapter format
  const descriptors = this.fileBridge.fileNodeToAdapterDescriptor(
    filesWithContent,
    adapter.type
  );
  
  // Push to remote
  await adapter.pushChanges(descriptors);
  
  // Mark as synced
  for (const file of dirtyFiles) {
    file.dirty = false;
    file.isSynced = true;
    file.syncStatus = 'idle';
    file.version++;
    await this.fileManager.saveFileNode(file);
  }
  
  return dirtyFiles;
}
```

**Testing:**
- Integration test: dirty FileNode → adapter push → mark synced
- Verify content loaded only when needed
- Verify version incremented

---

#### Task 3.3: Update sync manager entry points
**File:** `src/core/cache/sync-manager.ts` or handle-sync.ts  
**Effort:** 3 hours  
**Dependencies:** Task 3.1, Task 3.2  

- Update sync workflow to use new pull/push methods
- All sync operations work with FileNode type
- Remove old CachedFile references

**Testing:**
- Full sync cycle works end-to-end
- Pull then push in sequence

---

### PHASE 4: Store Layer

#### Task 4.1: Refactor file-explorer-store
**File:** file-explorer-store.ts  
**Effort:** 6 hours  
**Dependencies:** Task 2A.1  

```typescript
export const useFileExplorerStore = create<FileExplorerStore>((set, get) => ({
  fileTree: null as FileNode | null,
  expandedIds: new Set<string>(),
  selectedId: null,
  
  loadWorkspaceTree: async (workspaceId: string) => {
    const root = await fileManager.getWorkspaceTree(workspaceId);
    set({ fileTree: root });
  },
  
  expandFolder: (folderId: string) => {
    set(state => ({
      expandedIds: new Set([...state.expandedIds, folderId])
    }));
  },
  
  // Remove _buildFileTreeFromCache
  // Use getWorkspaceTree() directly
}));
```

**Testing:**
- Tree loads and renders
- Expand/collapse work
- Select/deselect work
- No FileNode↔CachedFile conversions

---

#### Task 4.2: Refactor editor-store
**File:** editor-store.ts  
**Effort:** 5 hours  
**Dependencies:** Task 2A.1  

```typescript
export const useEditorStore = create<EditorStore>((set, get) => ({
  openTabs: [] as FileNode[],
  activeTabId: null,
  
  openFile: async (fileNode: FileNode) => {
    // Load content if not present
    const fileWithContent = fileNode.content
      ? fileNode
      : await fileManager.getFileNodeWithContent(fileNode.id);
    
    set(state => ({
      openTabs: [...state.openTabs, fileWithContent],
      activeTabId: fileWithContent.id,
    }));
  },
  
  closeTab: (fileId: string) => {
    set(state => ({
      openTabs: state.openTabs.filter(f => f.id !== fileId),
    }));
  },
  
  updateFileContent: (fileId: string, content: string) => {
    set(state => ({
      openTabs: state.openTabs.map(f =>
        f.id === fileId ? { ...f, content, dirty: true } : f
      ),
    }));
  },
}));
```

**Testing:**
- Tabs open/close correctly
- Content loaded on demand
- Dirty flag set on edit
- MarkdownFile type removed

---

#### Task 4.3: Update workspace-store
**File:** workspace-store.ts  
**Effort:** 2 hours  
**Dependencies:** Task 2A.1  

- Replace CachedFile with FileNode
- Update queries to use file-manager methods
- Verify workspace switching works

**Testing:**
- Workspace loads correct files
- No type errors

---

### PHASE 5: UI Components

#### Task 5.1: Update file-explorer components
**Files:** components  
**Effort:** 5 hours  
**Dependencies:** Task 4.1  

- file-explorer.tsx: Render FileNode tree directly
- file-tree-item.tsx: Accept `FileNode`, no conversion
- Remove old FileNode↔CachedFile mapping

**Changes:**
```typescript
// BEFORE
interface FileTreeItemProps {
  node: FileNode;
  cachedFile: CachedFile; // Redundant
  onNodeClick: (node: FileNode) => void;
}

// AFTER
interface FileTreeItemProps {
  node: FileNode;
  onNodeClick: (node: FileNode) => void;
}

function FileTreeItem({ node, onNodeClick }: FileTreeItemProps) {
  return (
    <div>
      <span>{node.name}</span>
      {node.children && node.children.map(child => (
        <FileTreeItem key={child.id} node={child} onNodeClick={onNodeClick} />
      ))}
    </div>
  );
}
```

**Testing:**
- File tree renders without errors
- Click handlers work
- No TypeScript errors

---

#### Task 5.2: Update editor components
**Files:** components, plugins  
**Effort:** 4 hours  
**Dependencies:** Task 4.2  

- Tabs accept FileNode directly
- Open/save/delete operations use file-manager methods
- No MarkdownFile type

**Changes:**
- Remove `MarkdownFile` type from imports
- Replace with `FileNode`
- Update file operations

**Testing:**
- Tabs render correctly
- Open file works
- Save updates dirty flag
- Close tab works

---

#### Task 5.3: Update shared utilities
**Files:** utils, search-bar.tsx  
**Effort:** 3 hours  
**Dependencies:** Task 2A.1  

- file-path-resolver.ts: Work with `FileNode.path`
- Remove normalize-file-node.ts (logic in file-node-bridge)
- search-bar.tsx: Use `file-manager.queryByName()`

**Testing:**
- Path resolution works
- Search queries work

---

### PHASE 6: Tests & Documentation

#### Task 6.1: Create FileNodeBridge unit tests
**File:** `src/core/sync/__tests__/file-node-bridge.test.ts` (NEW)  
**Effort:** 6 hours  
**Dependencies:** Task 2B.1, Task 2B.2  

Tests for:
- GDrive entry → FileNode conversion
- Local FS stat → FileNode conversion
- S3 object → FileNode conversion
- FileNode → AdapterDescriptor for each type
- Edge cases (special chars, unicode, large files)
- Round-trip conversions

---

#### Task 6.2: Create sync pull/push integration tests
**File:** `tests/integration/sync-pull-push-flow.integration.test.ts` (NEW)  
**Effort:** 8 hours  
**Dependencies:** Task 3.1, Task 3.2  

Tests:
- Pull: mock adapter response → FileNode → RxDB
- Push: dirty FileNode → adapter format → mark synced
- Conflict detection and version management
- Batch operations
- Nested directory sync

---

#### Task 6.3: Update existing cache/file-manager tests
**File:** __tests__  
**Effort:** 5 hours  
**Dependencies:** Task 2A.1  

- Update mocks to use FileNode
- Test new methods (getFileNode, queryByPath, etc.)
- Test lazy-loading behavior
- Test RxDB indexes

---

#### Task 6.4: Update integration tests
**File:** integration  
**Effort:** 4 hours  
**Dependencies:** All phases  

- Update file-explorer tests
- Update editor tests
- Update workspace switching tests
- Verify no broken workflows

---

#### Task 6.5: Update ARCHITECTURE.md
**File:** ARCHITECTURE.md  
**Effort:** 4 hours  
**Dependencies:** All phases complete  

Add section: "FileNode Type & Sync Bridge Architecture"
- FileNode structure and lazy-loading strategy
- Sync bridge pattern explanation
- Data flow diagrams for pull and push
- Performance characteristics and indexes
- Update existing diagrams

Add new file: `docs/FILENODE-REFACTOR.md` (this document)

---

## Verification Checklist

### Pre-Merge Verification

- [ ] **Type Safety**
  - [ ] No `any` types in new code
  - [ ] FileNode used everywhere instead of old types
  - [ ] deprecated type aliases exist for backward compat

- [ ] **RxDB Schema**
  - [ ] Schema compiles
  - [ ] Indexes created successfully
  - [ ] Migration path defined if needed

- [ ] **File Manager API**
  - [ ] All new methods implemented
  - [ ] Lazy-loading works (content loaded on demand)
  - [ ] Queries use indexes efficiently
  - [ ] No N+1 query problems

- [ ] **Sync Bridge**
  - [ ] All adapter converters tested
  - [ ] Pull → FileNode → RxDB works
  - [ ] Push → adapter descriptors → remote works
  - [ ] Version/conflict detection works

- [ ] **Stores**
  - [ ] file-explorer-store works with FileNode tree
  - [ ] editor-store works with FileNode tabs
  - [ ] workspace-store updated
  - [ ] No state management errors

- [ ] **UI Components**
  - [ ] file-explorer renders correctly
  - [ ] editor tabs open/close/save correctly
  - [ ] no console errors
  - [ ] no TypeScript errors

- [ ] **Tests**
  - [ ] `yarn test` passes (≥95% existing coverage)
  - [ ] New tests for sync bridge pass
  - [ ] Integration tests pass
  - [ ] No flaky tests

- [ ] **Performance**
  - [ ] Startup time not regressed
  - [ ] Memory usage similar (lazy-load saves memory)
  - [ ] Large workspaces load quickly
  - [ ] No N+1 queries

### Post-Merge Monitoring

- [ ] E2E test all workspace types (Browser, Local, GDrive)
- [ ] Monitor sync errors/conflicts in production
- [ ] Check user feedback for regressions
- [ ] Monitor app performance metrics

---

## Risk Mitigation

### High-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Type breaking change** | All components fail | Comprehensive TypeScript checks before merge; deprecation aliases |
| **Sync data loss** | Users lose files | Extensive pull/push testing; backup data before deploy; rollback plan |
| **Performance regression** | Slow app | Profile memory/speed; lazy-load content; index all query paths |
| **RxDB schema migration** | Data corruption | Test migrations on large datasets; backup DB; gradual rollout |

### Rollback Plan

If critical issues found post-merge:
1. Revert commit to previous stable state
2. Restore RxDB from backup (if applicable)
3. Deploy hotfix with old code
4. Post-mortem on failures

### Testing Strategy

1. **Unit Tests:** All new code (converters, file-manager methods)
2. **Integration Tests:** Full sync cycles with multiple adapters
3. **E2E Tests:** Real user workflows (open file, edit, save, sync)
4. **Performance Tests:** Profile memory and startup time
5. **Compatibility Tests:** Old imports/APIs still work

---

## Success Criteria

✅ **Unified Type:** No FileDoc, CachedFile, or MarkdownFile in codebase (except deprecated aliases)

✅ **Type Safe:** Zero type conversion bugs; FileNode used everywhere

✅ **Performance:** Lazy-loaded content; no regression in startup/memory; fast queries via indexes

✅ **Sync Stable:** Pull/push cycles reliable; conflict detection works; version tracking accurate

✅ **Testable:** >95% coverage; sync bridge fully tested; integration tests for all workflows

✅ **Documented:** Architecture doc updated; refactor plan doc created; code well-commented

---

## Notes & Observations

1. **Content Serialization:** Full content stored in RxDB; for very large files, consider separate blob storage
2. **Nested Children:** Built on-demand in `getWorkspaceTree()`; not persisted to avoid duplication
3. **Lazy-Loading:** Content loaded only on `getFileNodeWithContent()`; UI tree uses metadata only
4. **Sync Bridge:** Adapter converters can be unit-tested independently
5. **Backward Compat:** Old type names available as aliases during transition
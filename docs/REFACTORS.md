# Architectural Refactors & Improvements

This document tracks ongoing and planned architectural improvements to Verve.

## 📋 Overview

As Verve evolves, several refactoring initiatives are underway to improve code maintainability, consistency, and performance. This document consolidates design specs, implementation guides, and status updates for these initiatives.

## 🔄 Active Refactors

### 1. **RxDB as Single Source of Truth**
**Status:** In Progress  
**Target:** March 2026

**Objective:** Establish RxDB as the canonical data store for all application state (files, workspaces, metadata, settings, sync queue).

**Current State:**
- RxDB collections exist for files and workspaces
- Some components still read/write directly to file system or legacy stores
- Sync adapters need consolidation

**Target State:**
- UI components and stores read/write exclusively through RxDB
- File Manager and Sync Manager coordinate all persistence operations
- Adapters (Browser/Local/Remote) are the only code interfacing with external storage
- Clear separation: Stores ↔ RxDB ↔ Sync Manager ↔ Adapters

**Key Documents:**
- [Refactor.md](./Refactor.md) - Detailed technical spec with API signatures
- [workspace-file-ops-architecture.md](./workspace-file-ops-architecture.md) - Architecture diagram and principles

**Implementation Areas:**
- [ ] File Explorer stores - migrate to RxDB queries
- [ ] Editor store - persist changes through RxDB
- [ ] Workspace manager - integrate with RxDB and handle metadata
- [ ] Sync Manager - subscribe to RxDB changes and coordinate adapters
- [ ] Directory handle persistence - store in RxDB with structured clone
- [ ] File operations facade - wrap all CRU operations with RxDB writes

---

### 2. **FileNode Unified Type Refactor**
**Status:** Planning Phase  
**Target:** Q2 2026

**Objective:** Consolidate four fragmented file type representations into a single `FileNode` type used consistently across:
- UI components
- State stores (Zustand)
- RxDB persistence layer
- Sync operations

**Current Fragmentation:**
- `FileNode` - UI tree structure (nested objects)
- `FileDoc` - RxDB storage (full content stored)
- `CachedFile` - Bridge type (flexible metadata)
- `MarkdownFile` - Editor tab representation

**Target State:**
- Single `FileNode` type definition in `src/shared/types/`
- RxDB schema aligns with FileNode structure
- Type-safe sync conversions through dedicated bridge
- Lazy-loaded content to reduce memory footprint

**Benefits:**
- Eliminate type conversion overhead (~500-1000 LOC reduced)
- Improve type safety and IDE support
- Unified query/indexing across all operations
- Better performance through optimized indexes

**Key Document:**
- [FILENODE-REFACTOR.md](./FILENODE-REFACTOR.md) - Comprehensive design, implementation phases, and task breakdown

**Core Changes:**
- [ ] Define unified FileNode schema
- [ ] Update RxDB collections to match FileNode
- [ ] Lazy-load file content with pointers
- [ ] Type-safe sync bridges for adapters
- [ ] Update all consumers to use FileNode
- [ ] Remove legacy type converters

---

### 3. **File Explorer Store Architecture**
**Status:** Audit Phase  
**Target:** Q1-Q2 2026

**Objective:** Ensure File Explorer stores and components exclusively use RxDB, eliminating direct file system access.

**Current Areas of Concern:**
- File Explorer components may call FileHandle APIs directly
- Some operations may bypass RxDB for workspace-specific logic
- Inconsistent adapter usage across features

**Target:**
- All file operations routed through RxDB
- Workspace-specific logic isolated in adapters
- Clear store interfaces for UI consumption

**Key Document:**
- [fix-file-explorer-stores.md](./fix-file-explorer-stores.md) - Audit guide and adapter interface spec

**Checklist:**
- [ ] Audit all file-explorer components for direct API calls
- [ ] Replace direct calls with RxDB + Sync Manager
- [ ] Implement standardized adapter interface
- [ ] Add integration tests for end-to-end flows

---

## 🎯 Quick Reference

### Refactor Documents by Focus
- **High-level Architecture:** [workspace-file-ops-architecture.md](./workspace-file-ops-architecture.md)
- **RxDB Integration:** [Refactor.md](./Refactor.md)
- **Type Consolidation:** [FILENODE-REFACTOR.md](./FILENODE-REFACTOR.md)
- **Store Audit:** [fix-file-explorer-stores.md](./fix-file-explorer-stores.md)

### Key Architectural Decisions
1. **RxDB is canonical** - no other store of truth for data
2. **Adapters are isolated** - workspace-specific logic stays encapsulated
3. **Lazy loading** - content loaded on-demand, not cached proactively
4. **Type safety** - single unified types with no manual conversion
5. **Observable-based** - use RxDB observables for reactive updates

---

## 📊 Impact Assessment

### Performance
- **Memory:** Lazy loading reduces heap size for large workspaces
- **Startup:** Faster initialization with indexed queries
- **Queries:** RxDB indexes enable efficient file lookups

### Development Experience
- **Type safety:** Single source of truth eliminates type confusion
- **Debugging:** Centralized RxDB state easier to inspect
- **Testing:** Clear adapter boundaries enable isolated unit tests

### Risk Mitigation
- **Backward compatibility:** RxDB migrations handle version changes
- **Conflict resolution:** Centralized in Sync Manager, not scattered
- **Data loss:** Durable sync queue prevents lost updates

---

## Contributing to Refactors

When working on these architectural improvements:

1. **Read the relevant design doc first** - Understand the target architecture
2. **Follow the checklist** - Ensure systematic coverage
3. **Add tests** - Integration tests verify each refactor step
4. **Update types** - Keep TypeScript definitions current
5. **Document decisions** - Comment on non-obvious choices

See [.github/copilot-instructions.md](../.github/copilot-instructions.md) for development workflow and conventions.

---

**Last Updated:** March 4, 2026  
**Maintainer:** Development Team

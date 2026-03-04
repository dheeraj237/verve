# Verve Architecture

This document provides a comprehensive overview of the Verve architecture for developers with beginner to intermediate experience in React and CodeMirror.

## Table of Contents

1. [System Overview](#system-overview)
2. [Application Layers](#application-layers)
3. [Data Flow](#data-flow)
4. [State Management](#state-management)
5. [Plugin System](#plugin-system)
6. [File Management](#file-management)

## System Overview

Verve is built with a modular, feature-based architecture that separates concerns and makes the codebase easy to understand and extend. The system uses Vite as the build tool, React 19 for the UI layer, Zustand for state management, and RxDB as the local database for data persistence.

```mermaid
graph TB
    subgraph UI["UI Layer"]
        AppShell["App Shell<br/>(VSCode-like Layout)"]
        Toolbar["Toolbar<br/>(Controls & Theme)"]
    end
    
    subgraph Features["Feature Modules"]
        Explorer["File Explorer<br/>(Tree Navigation)"]
        Editor["Markdown Editor<br/>(CodeMirror 6)"]
        Preview["Markdown Preview<br/>(react-markdown)"]
        TOC["Table of Contents<br/>(Scroll Sync)"]
    end
    
    subgraph State["State Layer"]
        PanelStore["Panel Store"]
        EditorStore["Editor Store"]
        FileStore["File Explorer Store"]
        TOCStore["TOC Store"]
    end
    
    subgraph Core["Core Systems"]
        FileManager["File Manager<br/>(Git-like Workflow)"]
        PluginSystem["Plugin System<br/>(CodeMirror Plugins)"]
        Cache["Cache Layer"]
    end
    
    subgraph Data["Data Layer"]
        RxDB["RxDB<br/>(Local Database)"]
        Adapters["Sync Adapters<br/>(Browser/Local/Remote)"]
    end
    
    UI --> Features
    Features --> State
    State --> Core
    Core --> Data
    
    Editor --> PluginSystem
```

### Key Principles

1. **Feature-Based Structure**: Each feature is self-contained with its own components, hooks, and state
2. **Separation of Concerns**: UI, business logic, and data are clearly separated
3. **Composition Over Inheritance**: Components are composed from smaller, reusable pieces
4. **Unidirectional Data Flow**: Data flows from parent to child, updates flow through stores

## Application Layers

### Layer 1: UI Components (`src/App.tsx` and `src/shared/components/`)

The outermost layer handles user interaction and presentation.

**Key Files:**
- `src/App.tsx` - Main application entry point
- `src/shared/components/app-shell.tsx` - Layout container with resizable panels
- `src/shared/components/app-toolbar.tsx` - Top toolbar with controls

**Responsibilities:**
- Render UI elements
- Handle user input
- Display data from stores
- Trigger actions via store methods

### Layer 2: Features (`src/features/`)

Feature modules encapsulate specific functionality.

#### File Explorer (`src/features/file-explorer/`)

```mermaid
graph TD
    FE[FileExplorer Component] --> FS[File Explorer Store]
    FS --> API[File API]
    API --> Disk[File System]
```

**Components:**
- `FileExplorer.tsx` - Tree view with context menu

**Store:**
- Manages file tree state
- Handles CRUD operations
-Tracks selected/expanded nodes

**Key Concepts:**
- Uses `react-complex-tree` for tree UI
- Context menu for file operations
- Inline editing for renames

#### Markdown Editor (`src/features/editor/`)

```mermaid
graph TD
    Editor[LiveMarkdownEditor] --> CM[CodeMirror 6]
    CM --> Plugins[CodeMirror Plugins]
    Plugins --> Widgets[Widget Decorations]
    
    Editor --> Store[Editor Store]
    Store --> FM[File Manager]
    Editor --> Preview[MarkdownPreview]
    Preview --> TOC[TableOfContents]
```

**Components:**
- `LiveMarkdownEditor.tsx` - Main editor component
- `MarkdownPreview.tsx` - Live markdown preview
- `TableOfContents.tsx` - TOC sidebar

**Plugins:** (`src/features/editor/plugins/`)
- `custom-link-plugin.tsx` - Interactive links
- `code-block-plugin.tsx` - Syntax-highlighted code
- `mermaid-plugin.tsx` - Diagram rendering
- `html-plugin.tsx` - HTML block rendering
- `list-plugin.tsx` - Styled lists
- `horizontal-rule-plugin.tsx` - Visual separators
- `plugin-utils.ts` - Shared utilities

**How Plugins Work:**

```typescript
// 1. Define what to render
class MyWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('div');
    //Render content
    return el;
  }
}

// 2. Find markdown to replace
function buildDecorations(state) {
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'TargetNode') {
        // Replace with widget
        decorations.push(
          Decoration.replace({ widget }).range(from, to)
        );
      }
    }
  });
}

// 3. Register as plugin
const myPlugin = StateField.define({
  create: buildDecorations,
  update: (deco, tr) => {
    if (tr.docChanged || tr.selection) {
      return buildDecorations(tr.state);
    }
    return deco;
  }
});
```

### Layer 3: Core Systems (`core/`)

Core systems provide Infrastructure and shared functionality.

#### File Manager (`src/core/cache/`)

The file manager handles the lifecycle of file operations with a git-like push/pull workflow. It manages conflict detection, external change detection, and coordinates with the cache layer and RxDB.

```mermaid
sequenceDiagram
    Editor->>Store: Content changed
    Store->>FileManager: applyPatch()
    FileManager->>FileManager: Pull (check version)
    alt Conflict detected
        FileManager->>Store: Pull latest
        Store->>Editor: Update content
    else No conflict
        FileManager->>API: Write file
        FileManager->>Store: Confirm saved
    end
```

**Key Features:**
- Automatic conflict detection
- Async file operations
- Scroll position preservation
- External change detection

#### State Management (`core/store/` and feature stores)

Uses Zustand for lightweight, performant state management:

```typescript
// Example store structure
const useEditorStore = create((set) => ({
  // State
  currentFile: null,
  viewMode: 'preview',
  
  // Actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setFile: (file) => set({ currentFile: file }),
}));
```

## Data Flow

### User Types in Editor

```mermaid
flowchart TD
    A[User Types] --> B[CodeMirror onChange]
    B --> C[Store: setContent]
    C --> D{Autosave Timer}
    D -->|2s elapsed| E[FileManager: applyPatch]
    E --> F[Check for conflicts]
    F -->|No conflict| G[Write to disk]
    F -->|Conflict| H[Pull latest]
    H --> I[Update editor]
```

### User Clicks on Rendered Widget

```mermaid
flowchart TD
    A[User Clicks Widget] --> B[Plugin: ignoreEvent = false]
    B --> C[CodeMirror handles click]
    C --> D[Selection moves into range]
    D --> E[Plugin: shouldShowSource = true]
    E --> F[Remove widget decoration]
    F --> G[Show markdown source]
```

## State Management

### Store Architecture

```mermaid
graph TD
    subgraph Stores
        PS[Panel Store]
        ES[Editor Store]
        FES[File Explorer Store]
        TS[TOC Store]
    end
    
    subgraph Components
        Shell[App Shell]
        Editor[Editor]
        Explorer[File Explorer]
        TOC[TOC]
    end
    
    Shell -.reads.-> PS
    Editor -.reads.-> ES
    Explorer -.reads.-> FES
    TOC -.reads.-> TS
    
    Shell -.updates.-> PS
    Editor -.updates.-> ES
    Explorer -.updates.-> FES
```

**Store Responsibilities:**

- **Panel Store**: Panel visibility and sizes
- **Editor Store**: Current file, view mode, save status
- **File Explorer Store**: Tree data, selected items
- **TOC Store**: Headings, active section

### State Update Pattern

```typescript
// 1. Component reads state
function MyComponent() {
  const file = useEditorStore(state => state.currentFile);
  const setFile = useEditorStore(state => state.setFile);
  
  // 2. User action triggers update
  const handleFileChange = async (newFile) => {
    // 3. Update store
    setFile(newFile);
  };
}
```

## Plugin System

### Plugin Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Plugin initialized
    Created --> Decorating: Document changed
    Created --> Decorating: Selection changed
    Decorating --> Rendered: Widgets created
    Rendered --> Decorating: User edits
    Rendered --> Interacting: User clicks widget
    Interacting --> Source: Show markdown
    Source --> Decorating: User clicks away
```

### Creating a Plugin

See [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md) for a detailed guide.

### Shared Utilities

All plugins use `plugin-utils.ts` for common operations:

```typescript
// Check if we should show source
shouldShowWidgetSourceState(state, from, to)

// Check selection overlap
hasSelectionOverlapState(state, from, to)

// Sanitize HTML
sanitizeHTML(htmlString)

// Detect markdown in HTML
containsMarkdown(content)
```

## File Management

### File Operation Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant E as Editor
    participant S as Store
    participant FM as File Manager
    participant RxDB as RxDB
    participant Adapters as Sync Adapters

    U->>E: Edit content
    E->>S: Update content
    S->>S: Start 2s autosave timer
    
    Note over S,FM: Autosave triggered
    S->>FM: applyPatch(fileId, content)
    FM->>RxDB: Get file document
    RxDB-->>FM: Current version
    
    alt No conflict
        FM->>RxDB: Update document
        RxDB-->>FM: Confirmed
        FM->>Adapters: Sync changes
        Adapters-->>FM: Synced
        FM-->>S: Update saved state
        S-->>E: Show "Saved" status
    else Conflict detected
        FM->>RxDB: Fetch latest
        RxDB-->>FM: Latest content
        FM-->>S: Update editor
        S-->>E: Show updated content
    end
```

### External Change Detection

The system detects external changes through RxDB's reactive updates and sync adapters:

```typescript
// RxDB emit$ observable watches for changes
DocumentCollection.find().$.subscribe(changes => {
  // Update UI when external changes are detected
  handleExternalUpdate(changes);
});

// Preserve scroll position during updates
updateEditor(content, { preserveScroll: true });
```

## Performance Considerations

### Bundle Size Optimization

- **Code splitting:** Feature-based modules enable efficient code splitting
- **Lazy loading:** Heavy dependencies (Mermaid, KaTeX) loaded on-demand
- **Tree-shaking:** Unused dependencies removed during build

### Render Optimization

- Memoization with `useMemo` for expensive computations
- `useCallback` for stable function references
- Zustand shallow equality for selective re-renders

### Editor Performance

- Viewport-based rendering (only visible decorations)
- Debounced autosave (2 seconds)
- Efficient decoration updates (only rebuild on change)

## For Beginners

If you're new to React or CodeMirror, here's where to start:

1. **Read the main README.md** - Understand what the app does
2. **Explore `/app/page.tsx`** - See how features are composed
3. **Look at a simple feature** - Start with File Explorer
4. **Understand a plugin** - Read `horizontal-rule-plugin.tsx` (simplest plugin)
5. **Read plugin-utils.ts** - Learn the common patterns
6. **Try modifying a plugin** - Change the styling of lists or links

### CodeMirror Concepts for Beginners

**State vs View:**
- `EditorState` - The document content and selection
- `EditorView` - The visual rendering of the state

**Extensions:**
- Plugins that extend CodeMirror functionality
- Can add decorations, handle events, modify behavior

**Decorations:**
- Visual modifications to the editor (widgets, marks, line decorations)
- Don't modify the actual document content

**Syntax Tree:**
- Parsed structure of the markdown
- Used to find specific nodes (headings, links, code blocks)

### React Concepts Used

- Functional components with hooks
- `useState` for local state
- `useEffect` for side effects
- `useRef` for DOM references
- Custom hooks for reusable logic
- Context for theme management
- Zustand for global state

---

For more information:
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) - Development guidelines
- Feature documentation in individual feature directories

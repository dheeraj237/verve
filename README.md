# 📝 Verve

A serene, VSCode-inspired markdown documentation editor built with **Vite** and **React 19**, featuring a powerful **Live Markdown Editor** powered by **CodeMirror 6** with real-time preview capabilities. Let your thoughts flow freely.

[![Vite](https://img.shields.io/badge/Vite-6.0-646cff)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-19.2.3-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![CodeMirror](https://img.shields.io/badge/CodeMirror-6-orange)](https://codemirror.net/)

## ✨ Features

### 🎨 Professional UI
- **VSCode-like interface** with three-panel layout (Explorer, Editor, TOC)
- **Workspace Management** - Create and switch between different workspaces (Browser, Local Files, Google Drive)
- **Enhanced Left Panel** - Redesigned navigation with workspace dropdown, search, opened files, and app actions
- **Resizable panels** with persistent sizing
- **Dark/Light theme** with smooth transitions
- **File tabs** with close functionality and active indicators
- **Status bar** with save status and file information
- **Global Search** - Quick file and command search with ⌘K shortcut

### 📁 Workspace Management
- **Multiple workspace types** - Browser storage, Local files, Google Drive (coming soon)
- **Opened files tracking** - Quick access to all open tabs
- **Smart search** - Find files and commands instantly
- **App actions panel** - Easy access to common operations

### 📝 Live Markdown Editor (CodeMirror 6)
Our custom-built live markdown editor provides a seamless WYSIWYG-like experience:

#### Core Editor Features
- ✅ **Live Preview** - See formatting as you type (Obsidian-style)
- ✅ **Syntax Highlighting** - Color-coded markdown syntax
- ✅ **Auto-save** - Changes saved automatically (2-second debounce)
- ✅ **Split View** - Edit and preview side-by-side
- ✅ **Vim Mode Support** - Vi/Vim keybindings available

#### Live Rendering Plugins
- ✅ **Smart Links** - Cmd/Ctrl+Click to open in new tab with tooltips
- ✅ **Code Blocks** - Syntax highlighting with copy button and line numbers
- ✅ **Mermaid Diagrams** - Live diagram rendering
- ✅ **Math Equations** - KaTeX rendering (inline and block)
- ✅ **Task Lists** - Interactive checkboxes
- ✅ **Lists** - Styled bullets and numbering
- ✅ **Images** - Inline image rendering
- ✅ **Tables** - GitHub Flavored Markdown tables
- ✅ **Horizontal Rules** - Visual separators
- ✅ **Blockquotes** - Styled quote blocks
- ✅ **HTML Blocks** - Render custom HTML and details/summary

#### Selection & Interaction
- 🎯 **Click to Edit** - Click on rendered elements to see source
- 🎯 **Selection-Aware** - Shows source when text is selected
- 🎯 **Smooth Transitions** - No jarring re-renders when moving cursor

### 📂 File Management
- **Tree-based file explorer** with `react-complex-tree`
- **Context menu** operations (rename, delete, create file/folder)
- **Inline editing** for file and folder names
- **Multiple file support** with tabs
- **Git-like workflow** - Pull before push, conflict detection
- **External change detection** - Auto-refreshes when files change externally
- **Seamless updates** - Preserves scroll position during saves

### 📚 Markdown Support
- **GitHub Flavored Markdown** (GFM)
- **Code blocks** with 15+ languages
- **Tables** with alignment
- **Lists** (bullet, ordered, task)
- **Images** with drag-and-drop support
- **Links** with auto-linking
- **Math equations** with KaTeX
- **Mermaid diagrams** for flowcharts and diagrams
- **HTML embedding** for custom layouts

### 📑 Table of Contents
- **Auto-generated** from document headings
- **Active section** highlighting on scroll
- **Smooth scrolling** to sections
- **Collapsible** sidebar
- **Nested headings** (H1-H6 support)

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        UI[App Shell<br/>VSCode-like Layout]
        Toolbar[Toolbar<br/>View Toggle, Theme]
    end

    subgraph "Features"
        Explorer[File Explorer<br/>Tree Navigation]
        Editor[Live Markdown Editor<br/>CodeMirror 6]
        Preview[Markdown Preview<br/>react-markdown]
        TOC[Table of Contents<br/>Scroll Sync]
    end

    subgraph "State Management"
        PanelStore[Panel Store<br/>Zustand]
        EditorStore[Editor Store<br/>Zustand]
        FileStore[File Explorer Store<br/>Zustand]
        TOCStore[TOC Store<br/>Zustand]
    end

    subgraph "Core Systems"
        FileManager[File Manager<br/>Git-like Workflow]
        PluginSystem[Plugin System<br/>CodeMirror Extensions]
        CacheLayer[Cache & RxDB<br/>Data Persistence]
        ThemeSystem[Theme System<br/>CSS Variables]
    end

    subgraph "Storage Layer"
        RxDB[RxDB<br/>Local Database]
        Adapters[Sync Adapters<br/>Browser/Local/Remote]
    end

    UI --> Explorer
    UI --> Editor
    UI --> Preview
    UI --> TOC

    Editor --> EditorStore
    Explorer --> FileStore
    Preview --> TOCStore

    EditorStore --> FileManager
    FileManager --> CacheLayer
    CacheLayer --> RxDB
    RxDB --> Adapters

    Editor --> PluginSystem
    UI --> ThemeSystem
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (recommended: 20+)
- Yarn package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd verve

# Install dependencies
yarn install

# Start development server (opens at http://localhost:5173)
yarn dev
```

The development server runs on Vite, providing hot module replacement and fast startup times.

### Project Structure

```
verve/
├── src/                              # Source code (all application code)
│   ├── App.tsx                      # Main application entry
│   ├── main.tsx                     # Vite entry point
│   │
│   ├── features/                    # Feature-based modules
│   │   ├── file-explorer/          # File tree navigation
│   │   │   ├── components/         # FileExplorer component
│   │   │   └── store/              # File tree state (Zustand)
│   │   │
│   │   ├── editor/                 # Live markdown editor with preview
│   │   │   ├── components/         # LiveMarkdownEditor, MarkdownPreview, TOC
│   │   │   ├── plugins/            # CodeMirror plugins
│   │   │   │   ├── plugin-utils.ts # Shared plugin utilities
│   │   │   │   ├── custom-link-plugin.tsx
│   │   │   │   ├── code-block-plugin.tsx
│   │   │   │   ├── mermaid-plugin.tsx
│   │   │   │   ├── html-plugin.tsx
│   │   │   │   └── ...             # More plugins
│   │   │   ├── hooks/              # Custom editor hooks
│   │   │   └── store/              # Editor & TOC state (Zustand)
│   │
│   ├── shared/                      # Shared resources
│   │   ├── components/             # Reusable UI components
│   │   │   ├── app-shell.tsx      # Main VSCode-like layout
│   │   │   ├── app-toolbar.tsx    # Top toolbar
│   │   │   └── ui/                # shadcn/ui components
│   │   ├── types/                  # TypeScript type definitions
│   │   └── utils/                  # Utility functions
│   │
│   ├── core/                        # Core systems
│   │   ├── auth/                   # Authentication (Google)
│   │   ├── cache/                  # Cache & file operations
│   │   ├── config/                 # Configuration & feature flags
│   │   ├── file-manager/           # File lifecycle management
│   │   ├── init/                   # Initialization
│   │   ├── loading/                # Loading utilities
│   │   ├── rxdb/                   # RxDB database setup
│   │   ├── store/                  # Global Zustand stores
│   │   └── sync/                   # Sync adapters & bridges
│   │
│   ├── hooks/                       # Custom React hooks
│   ├── pages/                       # Page components
│   ├── styles/                      # Global CSS & themes
│   ├── utils/                       # Utility functions
│   └── __mocks__/                   # Test mocks
│
├── tests/                            # Test files
│   ├── e2e/                        # End-to-end tests
│   ├── integration/                # Integration tests
│   └── unit/                       # Unit tests (inline)
│
├── public/                           # Static assets
│   ├── 404.html                    # Error page
│   └── content/                    # Sample markdown files
│
├── docs/                             # Documentation
│   ├── ARCHITECTURE.md             # System architecture
│   └── ...                         # Other guides
│
└── vite.config.ts                  # Vite configuration
```

## 📖 How It Works

### Live Markdown Editing

The Live Markdown Editor uses CodeMirror 6 with custom plugins to provide a WYSIWYG-like experience:

```mermaid
sequenceDiagram
    participant User
    participant Editor as CodeMirror Editor
    participant Plugins as CodeMirror Plugins
    participant Store as Editor Store
    participant FileManager
    participant FS as File System

    User->>Editor: Types markdown
    Editor->>Plugins: Update decorations
    Plugins->>Plugins: Build widget decorations
    Plugins-->>Editor: Render widgets

    Editor->>Store: Content changed
    Store->>Store: Start autosave timer (2s)

    Store->>FileManager: applyPatch(content)
    FileManager->>FileManager: Check for conflicts
    FileManager->>FS: Write file
    FS-->>FileManager: Confirm write
    FileManager-->>Store: Update saved state

    alt User clicks on widget
        User->>Plugins: Click rendered element
        Plugins->>Editor: Show source
        Editor-->>User: Display markdown source
    end
```

### Plugin System

Each plugin follows a common pattern:

```typescript
// 1. Define widget for rendering
class CustomWidget extends WidgetType {
  toDOM() {
    // Create DOM element
    const element = document.createElement('div');
    element.innerHTML = this.renderContent();
    return element;
  }

  ignoreEvent() {
    // Control how CodeMirror handles events
    return false; // Let CodeMirror handle for editing
  }
}

// 2. Build decorations
function buildDecorations(state: EditorState): DecorationSet {
  const decorations = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      // Find markdown nodes to replace
      if (node.name === 'TargetNode') {
        // Check if we should show source or rendered
        if (!shouldShowWidgetSourceState(state, node.from, node.to)) {
          const widget = new CustomWidget(data);
          decorations.push(
            Decoration.replace({ widget }).range(node.from, node.to)
          );
        }
      }
    }
  });

  return Decoration.set(decorations);
}

// 3. Create StateField
const customPlugin = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },

  update(deco, tr) {
    // Rebuild on document or selection change
    if (tr.docChanged || tr.selection) {
      return buildDecorations(tr.state);
    }
    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});
```

### File Management Workflow

```mermaid
flowchart TD
    A[User Edits Content] --> B[Editor onChange]
    B --> C[Store: Update Local State]
    C --> D{Autosave Timer<br/>2 seconds}
    D -->|Timer Expires| E[FileManager: applyPatch]

    E --> F[Pull: Check Latest Version]
    F --> G{Conflict?}

    G -->|Yes| H[Pull Latest Content]
    H --> I[Update Editor]
    I --> J[Show Notification]

    G -->|No| K[Commit: Write to File]
    K --> L[Update Cache Version]
    L --> M[Store: Mark as Saved]

    N[External File Change] --> O[File Watcher Detects]
    O --> P[Pull Latest Content]
    P --> Q[Update Cache]
    Q --> R[Notify Store]
    R --> S[Update Editor<br/>Preserve Scroll]
```

## 🛠️ Technology Stack

### Core Framework
- **Vite** 6.x (Lightning-fast build tool)
- **React** 19.2.3 (UI framework)
- **TypeScript** 5 (Strict mode)
- **Tailwind CSS** 4 (Utility-first CSS)

### Editor & Rendering
- **CodeMirror** 6.x (Extensible code editor)
- **codemirror-live-markdown** (Live preview)
- **react-markdown** 10.1.0 (Markdown rendering)
- **remark-gfm** 4.0.1 (GitHub Flavored Markdown)
- **rehype-sanitize** 6.0.0 (HTML sanitization)
- **KaTeX** 0.16.27 (Math rendering)
- **Mermaid** 11.12.2 (Diagram rendering)

### UI & Components
- **Radix UI** (Accessible components)
- **shadcn/ui** (Component library)
- **lucide-react** 0.563.0 (Icon system)
- **next-themes** 0.4.6 (Theme management)
- **class-variance-authority** (Component variants)

### State & Data
- **Zustand** 5.0.10 (Lightweight state management)
- **RxDB** 14.13.0 (Local database)
- **RxJS** 7.8.2 (Reactive programming)
- **react-complex-tree** 2.6.1 (Tree component)
- **react-resizable-panels** 2.0.0 (Resizable layout)
- **Dexie** 4.3.0 (IndexedDB wrapper)

### Development Tools
- **Yarn** (Package manager)
- **ESLint** 9 (Code linting)
- **Jest** 29 (Testing framework)
- **TypeScript** strict mode (Type safety)

## 📋 Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md) - System architecture, data flow, and design patterns
- [Copilot Instructions](./.github/copilot-instructions.md) - Development guidelines and conventions
- [File Manager](./src/core/cache/) - File lifecycle and synchronization
- [RxDB Setup](./src/core/rxdb/) - Database schema and collections

## 🎯 Roadmap

### ✅ Completed
- Live markdown editor with CodeMirror 6
- Custom plugin system (links, code blocks, mermaid, HTML, etc.)
- File management with git-like workflow
- VSCode-like three-panel layout
- Dark/light theme support
- Auto-save with conflict detection
- External file change detection
- Table of contents with scroll sync

### 🚧 In Progress
- [ ] Full-text search across files
- [ ] Split view mode (side-by-side editor and preview)
- [ ] Vim mode enhancements

### 📅 Planned
- [ ] Collaborative editing (WebSocket)
- [ ] Export to PDF/HTML
- [ ] Git integration
- [ ] Plugin marketplace
- [ ] Mobile responsive design
- [ ] Offline mode with sync queue

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

```bash
# Create a new branch
git checkout -b feature/my-feature

# Make changes and test
yarn dev

# Build and verify
yarn build

# Commit with conventional commits
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/my-feature
```

## 📄 License

This project is MIT licensed. See [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- [CodeMirror](https://codemirror.net/) - Extensible code editor
- [codemirror-live-markdown](https://github.com/Milkdown/codemirror-live-markdown) - Live markdown base
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [Mermaid](https://mermaid.js.org/) - Diagram rendering
- [KaTeX](https://katex.org/) - Math rendering

---

**Version**: 0.1.0
**Last Updated**: March 4, 2026
**Maintainer**: Development Team

> "Document everything. Analyze everything. Understand everything." - Verve

Made with ❤️ using React and CodeMirror
yarn preview

# Deploy to AWS S3 (requires configured bucket)
./deploy-s3.sh your-bucket-name
```

For detailed deployment instructions, see the project's deployment guides.

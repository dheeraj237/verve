# MDNotes Viewer - Development Roadmap

A modern, VSCode-inspired markdown documentation viewer built with Next.js 15, featuring extensible architecture for incremental feature development.

---

## Phase 1: Core Foundation ✅

### Completed Features

- [x] **Project Setup** (v1.0.0)
  - Next.js 15 with App Router
  - TypeScript configuration
  - Yarn package manager
  - Fast dev experience (no slow build tools)

- [x] **Theming System** (v1.0.0)
  - Tailwind CSS with design tokens
  - CSS variables for light/dark themes
  - next-themes integration
  - VSCode-inspired color palette
  - Custom scrollbar styling

- [x] **Feature-Based Architecture** (v1.0.0)
  - `features/` folder structure
  - `shared/` components and utilities
  - `core/` config and store
  - TypeScript types system
  - Feature flags configuration

- [x] **State Management** (v1.0.0)
  - Zustand stores (panel, editor, file explorer)
  - Persistence with localStorage
  - Modular store architecture

---

## Phase 2: VSCode-like UI (In Progress)

### Current Sprint

- [ ] **Resizable Panel Layout** (v1.0.0)
  - Three-panel structure with `react-resizable-panels`
  - Collapsible left sidebar (file explorer)
  - Main editor area
  - Collapsible right sidebar (TOC/outline)
  - Panel state persistence
  - Keyboard shortcuts for panel toggle

- [ ] **File Explorer Component** (v1.0.0)
  - `react-complex-tree` implementation
  - Hierarchical file navigation
  - Folder expand/collapse with icons
  - File selection and highlighting
  - Context menu (future)
  - Search bar integration

- [ ] **Top Toolbar** (v1.0.0)
  - View mode toggle (Preview/Edit/Split)
  - Theme switcher button
  - File path breadcrumbs
  - Action buttons (upload, settings)

---

## Phase 3: Markdown Rendering

### Planned Features

- [ ] **Markdown Preview** (v1.0.0)
  - `react-markdown` with `remark-gfm`
  - GitHub Flavored Markdown support
  - Syntax highlighting with `rehype-prism-plus`
  - Custom link resolver (relative paths)
  - `@tailwindcss/typography` styling
  - Emoji support

- [ ] **Mermaid Diagrams** (v1.0.0)
  - Client-side Mermaid rendering
  - Flowcharts, sequence diagrams, ER diagrams
  - Theme-aware diagram colors
  - Lazy loading for performance
  - Error boundary for invalid diagrams

- [ ] **Table of Contents** (v1.0.0)
  - Auto-generated from headings
  - Active section highlighting on scroll
  - Smooth scroll navigation
  - Nested heading structure
  - Collapsible sections

- [ ] **Custom Markdown Components** (v1.1.0)
  - Callout boxes (info, warning, error)
  - Code block with copy button
  - Image zoom on click
  - Video embeds
  - Math equations (KaTeX - optional plugin)

---

## Phase 4: Markdown Editor

### Planned Features

- [ ] **CodeMirror Integration** (v1.0.0)
  - `@codemirror/lang-markdown` for editing
  - Syntax highlighting in editor
  - Line numbers and gutter
  - Auto-indentation
  - Bracket matching

- [ ] **View Mode Switching** (v1.0.0)
  - **Preview Mode** (default): Rendered markdown
  - **Edit Mode**: Raw markdown editing
  - **Split Mode**: Side-by-side editor + preview
  - Smooth transitions between modes
  - Keyboard shortcut (Cmd/Ctrl + K)

- [ ] **Editor Features** (v1.1.0)
  - Auto-save to localStorage
  - Undo/redo history
  - Find and replace
  - Word count display
  - Markdown shortcuts (bold, italic, etc.)

---

## Phase 5: File Management

### Planned Features

- [ ] **File Upload** (v1.2.0)
  - Drag and drop interface
  - Multiple file selection
  - Markdown file validation
  - Progress indicator
  - Error handling

- [ ] **File System API** (v1.2.0)
  - GET `/api/files` - List all files
  - GET `/api/files/[path]` - Get file content
  - POST `/api/files/upload` - Upload new file
  - DELETE `/api/files/[path]` - Delete file (future)
  - PUT `/api/files/[path]` - Update file (future)

- [ ] **Content Directory** (v1.2.0)
  - Copy existing markdown files to `/content/`
  - Maintain folder structure (sse-topics, system-design)
  - Automatic file tree generation
  - Watch for file changes (dev mode)

---

## Phase 6: Search & Navigation

### Planned Features

- [ ] **File Search** (v1.3.0)
  - Fuzzy file name search
  - `minisearch` integration
  - Search bar in file explorer
  - Keyboard shortcut (Cmd/Ctrl + P)
  - Recent files list

- [ ] **Content Search** (v1.4.0)
  - Full-text search across all files
  - Search results highlighting
  - Search in current file
  - Regular expression support
  - Search history

- [ ] **Quick Navigation** (v1.3.0)
  - Command palette (Cmd/Ctrl + Shift + P)
  - Go to heading
  - Go to line
  - Back/forward navigation

---

## Phase 7: Enhanced Features

### Planned Features

- [ ] **Roadmap Tracker UI** (v1.5.0)
  - Parse this ROADMAP.md file
  - Display in collapsible panel
  - Checkbox status tracking
  - Phase progress indicators
  - Roadmap search/filter

- [ ] **Favorites/Bookmarks** (v1.5.0)
  - Star files for quick access
  - Bookmarks section in sidebar
  - Bookmark sync to localStorage
  - Export bookmarks

- [ ] **Recent Files** (v1.5.0)
  - Track recently opened files
  - Display in sidebar
  - Clear history option
  - Limit to last 10 files

- [ ] **Settings Panel** (v1.6.0)
  - Theme customization
  - Editor preferences
  - Font size adjustment
  - Line height settings
  - Feature toggle UI

---

## Phase 8: Advanced Features (Future)

### Experimental / Optional Features

- [ ] **Plugin System** (v2.0.0)
  - Plugin architecture
  - Custom markdown extensions
  - Custom syntax highlighters
  - Plugin marketplace (future)

- [ ] **Export Functionality** (v2.0.0)
  - Export to PDF
  - Export to HTML
  - Print-optimized CSS
  - Markdown bundle download

- [ ] **Collaboration** (v2.5.0)
  - User authentication (NextAuth.js)
  - Multi-user file sharing
  - Comments on markdown
  - Version history

- [ ] **AI Assistant** (v3.0.0)
  - AI-powered search
  - Content summarization
  - Question answering
  - Markdown generation

- [ ] **Database Integration** (v2.0.0)
  - Prisma + PostgreSQL
  - File metadata storage
  - Full-text search indexing
  - User data persistence

---

## Performance Targets

### Lighthouse Scores
- **Performance**: 95+
- **Accessibility**: 100
- **Best Practices**: 95+
- **SEO**: 100

### Bundle Size Goals
- **Initial JS**: < 200KB
- **First Load JS**: < 400KB
- **Markdown viewer chunk**: < 100KB

### Core Web Vitals
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

---

## Technology Stack

### Core
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Variables
- **Package Manager**: Yarn

### UI Components
- **Panels**: react-resizable-panels
- **File Tree**: react-complex-tree
- **Icons**: lucide-react
- **Theming**: next-themes

### Markdown
- **Renderer**: react-markdown
- **Extensions**: remark-gfm, rehype-prism-plus
- **Diagrams**: mermaid
- **Editor**: @codemirror/lang-markdown
- **Styling**: @tailwindcss/typography

### State & Data
- **State Management**: Zustand
- **Search**: minisearch
- **Utilities**: clsx, tailwind-merge, class-variance-authority

---

## Development Guidelines

### Architecture Principles
1. **Feature-based structure**: Each feature is self-contained
2. **Modular design**: Easy to add/remove features
3. **Type-safe**: Comprehensive TypeScript types
4. **Performance-first**: Code splitting, lazy loading
5. **Accessibility**: WCAG 2.1 AA compliance

### Code Standards
- Use functional components with hooks
- Implement proper error boundaries
- Add loading states for async operations
- Write meaningful commit messages
- Test each feature before moving to next

### Git Workflow
- `main` branch: Production-ready code
- `develop` branch: Integration branch
- Feature branches: `feature/[feature-name]`
- Commit format: `[Phase X] Feature description`

---

## Getting Started

```bash
# Install dependencies
yarn install

# Run development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start
```

---

## Contributing

1. Check this roadmap for next planned feature
2. Create feature branch from `develop`
3. Implement feature with tests
4. Update roadmap checkboxes
5. Create pull request
6. Code review and merge

---

**Current Version**: 1.0.0-alpha  
**Last Updated**: January 23, 2026  
**Next Milestone**: Phase 2 - VSCode-like UI

---

*This roadmap is a living document and will be updated as features are completed and new requirements emerge.*

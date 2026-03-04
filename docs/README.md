# Verve Documentation

Welcome to the Verve documentation. This guide will help you understand the project structure, architecture, and how to contribute.

## 📚 Documentation Guide

### Getting Started
- **[README.md](../README.md)** - Project overview, features, and quick start guide
- **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Development guidelines and conventions

### Architecture & Design
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, data flow, and core components
  - Application layers (UI, Features, Core Systems, Data)
  - State management with Zustand
  - Plugin system for CodeMirror
  - Performance optimization
  - Quick implementation checklists

### Active Development
- **[REFACTORS.md](./REFACTORS.md)** - Ongoing architectural improvements and refactoring initiatives
  - RxDB as single source of truth
  - FileNode unified type consolidation
  - File Explorer store architecture
  - Contributing guidelines for refactors

### Feature-Specific Docs
Each feature module may contain additional documentation:
- `src/features/*/` - Feature-specific implementation details
- `src/core/*/` - Core system documentation (cache, sync, rxdb, store)

## 🎯 Choose Your Path

### I'm new to the project
1. Read [README.md](../README.md) to understand what Verve is
2. Follow the installation steps in README
3. Explore [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the structure
4. Start with simple features (File Explorer is a good starting point)

### I'm implementing a feature
1. Review [.github/copilot-instructions.md](../.github/copilot-instructions.md) for conventions
2. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for relevant patterns
3. Look at similar features for examples
4. Add tests as you implement

### I'm working on a refactor
1. Read [REFACTORS.md](./REFACTORS.md) to understand scope and status
2. Find the relevant design document (Refactor.md, FILENODE-REFACTOR.md, etc.)
3. Follow the implementation checklist
4. Add tests at each step

### I'm debugging something
1. Start with [ARCHITECTURE.md](./ARCHITECTURE.md) for data flow diagrams
2. Check `src/core/store/` to understand Zustand store patterns
3. Review sync flow in `src/core/sync/` for file operation issues
4. Look at relevant plugin code in `src/features/editor/plugins/`

## 📋 Quick Reference

### Key File Locations
- **Application Entry:** `src/main.tsx`, `src/App.tsx`
- **Features:** `src/features/{feature-name}/`
- **Shared Components:** `src/shared/components/`
- **Stores:** `src/core/store/`, `src/features/*/store/`
- **Database:** `src/core/rxdb/`
- **Cache & Persistence:** `src/core/cache/`
- **Sync System:** `src/core/sync/`
- **Editor Plugins:** `src/features/editor/plugins/`
- **Tests:** `tests/`, inline `*.test.ts` files
- **Config:** `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`

### Tech Stack
- **Build Tool:** Vite 6
- **UI Framework:** React 19 + TypeScript 5
- **Styling:** Tailwind CSS 4
- **Editor:** CodeMirror 6
- **State:** Zustand
- **Database:** RxDB + IndexedDB
- **Components:** Radix UI + shadcn/ui

### Development Commands
```bash
# Install dependencies
yarn install

# Start development server (http://localhost:5173)
yarn dev

# Build for production
yarn build

# Run tests
yarn test

# Check linting
yarn lint

# Type checking
yarn tsc --noEmit
```

## 🤝 Contributing

When contributing to Verve:
1. Read the relevant documentation above
2. Follow the conventions in [.github/copilot-instructions.md](../.github/copilot-instructions.md)
3. Keep documentation updated as you make changes
4. Add tests for new features
5. Use meaningful commit messages

## 📞 Need Help?

- Check the documentation files listed above
- Review similar code in the codebase for examples
- Check test files (`*.test.ts`) for usage patterns
- Review architecture diagrams in ARCHITECTURE.md for data flow

---

**Last Updated:** March 4, 2026  
**Version:** 0.1.0

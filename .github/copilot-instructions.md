# GitHub Copilot Instructions for MDNotes Viewer

## Project Overview

**MDNotes Viewer** is a modern, VSCode-inspired markdown documentation viewer built with Next.js 15. It provides a professional interface for viewing and editing markdown files with Mermaid diagram support, syntax highlighting, and a feature-rich editing experience.

### Key Technologies
- **Framework**: Next.js 15 (App Router) with TypeScript
- **Package Manager**: Yarn (for faster development)
- **Styling**: Tailwind CSS with CSS Variables for theming
- **State Management**: Zustand with persistence
- **UI Components**: Custom components + Radix UI primitives
- **Markdown**: react-markdown, remark-gfm, Mermaid
- **Editor**: CodeMirror 6
- **Icons**: lucide-react

---

## Architecture Principles

### 1. Feature-Based Structure
```
features/
├── file-explorer/      # File tree and navigation
├── markdown-preview/   # Markdown rendering
├── markdown-editor/    # CodeMirror integration
└── roadmap-tracker/    # Development roadmap UI
```

Each feature is self-contained with:
- `components/` - Feature-specific React components
- `hooks/` - Custom hooks for feature logic
- `store/` - Zustand store for feature state

### 2. Shared Resources
```
shared/
├── components/ui/      # Reusable UI components
├── hooks/             # Shared hooks
├── utils/             # Utility functions (cn, etc.)
└── types/             # TypeScript type definitions
```

### 3. Core Configuration
```
core/
├── config/            # Feature flags, settings
├── plugins/           # Plugin system
└── store/             # Global state (panels, etc.)
```

### 4. Design Tokens
All colors use HSL format with CSS variables for theme switching:
```css
--background: 0 0% 100%;
--foreground: 222.2 47.4% 11.2%;
--primary: 221.2 83.2% 53.3%;
--sidebar-background: 218 18% 97%;
--editor-background: 0 0% 99%;
```

---

## Development Guidelines

### Code Style
1. **Use functional components** with hooks (no class components)
2. **"use client"** directive for client components
3. **TypeScript strict mode** - all components must be typed
4. **Utility-first CSS** - use Tailwind classes, avoid custom CSS
5. **Import organization**:
   ```typescript
   // External libraries
   import { useState } from "react";
   import { FileTree } from "react-complex-tree";
   
   // Internal aliases
   import { Button } from "@/shared/components/ui/button";
   import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
   import { cn } from "@/shared/utils/cn";
   ```

### Component Patterns
```typescript
// Always export named functions
export function ComponentName() {
  // State
  const [state, setState] = useState();
  const store = useStore();
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  // Handlers
  const handleAction = () => {
    // Handler logic
  };
  
  // Render
  return (
    <div className={cn("base-classes", conditional && "conditional-class")}>
      {/* Component JSX */}
    </div>
  );
}
```

### State Management with Zustand
```typescript
// Create store in feature/store/ directory
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StoreState {
  value: string;
  setValue: (val: string) => void;
}

export const useFeatureStore = create<StoreState>()(
  persist(
    (set) => ({
      value: "",
      setValue: (val) => set({ value: val }),
    }),
    { name: "feature-storage" }
  )
);
```

### File Naming Conventions
- Components: `kebab-case.tsx` (e.g., `file-explorer.tsx`)
- Hooks: `use-feature-name.ts` (e.g., `use-file-tree.ts`)
- Types: `index.ts` or `feature-types.ts`
- Stores: `feature-store.ts` (e.g., `editor-store.ts`)
- Utils: `utility-name.ts` (e.g., `cn.ts`)

---

## Current Project Status

### ✅ Completed (Phase 1-2)
- Next.js 15 project setup with TypeScript
- Tailwind CSS with design tokens (light/dark theme)
- Feature-based folder structure
- Zustand stores (panel, editor, file-explorer)
- Theme provider with next-themes
- VSCode-like layout with resizable panels
- App toolbar with view mode toggle
- Theme toggle button
- Basic UI components (Button, Separator)
- ROADMAP.md with detailed feature tracking

### 🚧 In Progress (Phase 2-3)
- File explorer with react-complex-tree
- File system API routes
- Markdown preview with react-markdown
- Mermaid diagram rendering

### 📋 Roadmap Reference
See [ROADMAP.md](./ROADMAP.md) for complete feature roadmap and development phases.

**Current Focus**: Phase 2 - VSCode-like UI completion and Phase 3 - Markdown rendering

---

## Common Tasks & Patterns

### Adding a New Feature
1. Create feature directory: `features/feature-name/`
2. Add subdirectories: `components/`, `hooks/`, `store/`
3. Create store if needed: `store/feature-store.ts`
4. Update feature flags: `core/config/features.ts`
5. Implement components using shared UI components
6. Export main component from `components/index.ts`

### Creating a UI Component
```typescript
// shared/components/ui/component-name.tsx
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils/cn";

const componentVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "default-classes",
        secondary: "secondary-classes",
      },
      size: {
        default: "default-size",
        sm: "small-size",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  // Additional props
}

export function Component({ className, variant, size, ...props }: ComponentProps) {
  return (
    <div
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

### Adding an API Route
```typescript
// app/api/feature/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Logic
    return NextResponse.json({ data: "result" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error message" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Logic
  return NextResponse.json({ success: true });
}
```

### Working with Markdown
```typescript
// Use react-markdown with plugins
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypePrism]}
      className="prose dark:prose-invert max-w-none"
      components={{
        // Custom components for links, images, etc.
        a: ({ href, children }) => (
          <a href={href} className="text-primary hover:underline">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

### Mermaid Integration Pattern
```typescript
// Client-side only
"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

export function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      mermaid.initialize({ theme: "default" });
      mermaid.render("mermaid-diagram", code).then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      });
    }
  }, [code]);

  return <div ref={ref} className="mermaid-container" />;
}
```

---

## Performance Considerations

### Bundle Size
- Keep initial bundle < 200KB
- Use dynamic imports for heavy components:
  ```typescript
  const MermaidDiagram = dynamic(() => import("./mermaid-diagram"), {
    loading: () => <div>Loading diagram...</div>,
  });
  ```

### Code Splitting
- Feature components should be lazy-loaded when not immediately needed
- Use React.lazy() for route-level splitting
- CodeMirror and Mermaid should be dynamically imported

### Optimization
- Use `useMemo` for expensive computations
- Use `useCallback` for stable function references
- Implement virtualization for large file lists
- Debounce search inputs (300ms)

---

## Testing Guidelines

### Component Testing
- Test user interactions
- Test theme switching
- Test responsive behavior
- Test accessibility (keyboard navigation)

### Integration Testing
- Test file upload flow
- Test markdown rendering
- Test view mode switching
- Test panel resizing and collapse

---

## Accessibility Requirements

- All interactive elements must be keyboard accessible
- Use semantic HTML (button, nav, aside, main, article)
- Include ARIA labels for icon-only buttons
- Maintain proper heading hierarchy
- Support screen readers
- Ensure color contrast meets WCAG 2.1 AA standards

---

## Error Handling

### Pattern for Components
```typescript
import { useEffect, useState } from "react";

export function Component() {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div className="text-destructive p-4">
        <p>Error: {error.message}</p>
      </div>
    );
  }

  return <div>Component content</div>;
}
```

### Pattern for API Routes
```typescript
export async function GET(request: NextRequest) {
  try {
    // Logic
    return NextResponse.json({ data: "result" });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

---

## Git Commit Conventions

Format: `[Phase X] Brief description`

Examples:
- `[Phase 2] Add file explorer component`
- `[Phase 3] Implement markdown preview`
- `[Fix] Resolve theme switching issue`
- `[Refactor] Optimize panel state management`

---

## VSCode Settings

Recommended `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

---

## Quick Reference: Key Files

### Configuration
- `tailwind.config.ts` - Tailwind configuration with design tokens
- `tsconfig.json` - TypeScript configuration
- `next.config.ts` - Next.js configuration
- `core/config/features.ts` - Feature flags

### State Management
- `core/store/panel-store.ts` - Panel visibility and sizes
- `features/markdown-editor/store/editor-store.ts` - Editor state and mode
- `features/file-explorer/store/file-explorer-store.ts` - File tree state

### Key Components
- `shared/components/app-shell.tsx` - Main layout with panels
- `shared/components/app-toolbar.tsx` - Top toolbar
- `shared/components/theme-provider.tsx` - Theme context
- `shared/components/theme-toggle.tsx` - Theme switcher button

### Utilities
- `shared/utils/cn.ts` - Class name merger (clsx + tailwind-merge)
- `shared/types/index.ts` - Core TypeScript types

---

## Next Development Steps

Refer to [ROADMAP.md](./ROADMAP.md) for detailed roadmap. Current priorities:

1. **File Explorer** (Phase 2)
   - Implement react-complex-tree for file navigation
   - Create file system API routes
   - Add search functionality

2. **Markdown Preview** (Phase 3)
   - Integrate react-markdown with plugins
   - Add Mermaid diagram support
   - Implement custom link resolver
   - Style with @tailwindcss/typography

3. **CodeMirror Editor** (Phase 4)
   - Add markdown editing capability
   - Implement view mode switching
   - Sync scroll in split mode

---

## Important Notes

### DO
✅ Use "use client" directive for client components  
✅ Follow feature-based architecture  
✅ Use Zustand for state management  
✅ Apply design tokens for colors  
✅ Add proper TypeScript types  
✅ Use semantic HTML  
✅ Implement error boundaries  
✅ Optimize for performance  

### DON'T
❌ Use class components  
❌ Hardcode colors (use CSS variables)  
❌ Mix features in shared components  
❌ Ignore accessibility  
❌ Skip error handling  
❌ Create large bundle sizes  
❌ Use npm (use yarn instead)  
❌ Use slow build tools  

---

## Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [Mermaid Docs](https://mermaid.js.org/)
- [CodeMirror 6](https://codemirror.net/)
- [Radix UI](https://www.radix-ui.com/)

---

**Last Updated**: January 23, 2026  
**Version**: 1.0.0-alpha  
**Maintainer**: Development Team

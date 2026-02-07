# GitHub Copilot Instructions for MDNotes Viewer

## Tech Stack
- **Framework**: Next.js 16.1.4 (App Router) with TypeScript 5
- **Package Manager**: Yarn
- **React**: 19.2.3 with Server/Client Components
- **Styling**: Tailwind CSS 4 with CSS Variables
- **State Management**: Zustand 5.0.10
- **UI Components**: shadcn/ui (Radix UI + Tailwind + CVA)
- **Markdown**: react-markdown, remark-gfm, rehype-prism-plus
- **Editor**: CodeMirror 6
- **Icons**: lucide-react

## Architecture
```
features/          # Feature-based modules (file-explorer, editor)
shared/            # Shared UI components, utils, types
  components/ui/   # shadcn/ui components
core/              # Config, stores, file-manager
app/               # Next.js app router
```

## Code Style
- ✅ Use "use client" for client components
- ✅ TypeScript strict mode
- ✅ Functional components with hooks
- ✅ Use shadcn/ui components for all UI needs
- ✅ Tailwind utility classes (no custom CSS)
- ✅ Feature-based folder structure
- ❌ No class components
- ❌ No hardcoded colors (use CSS variables)

## Key Patterns
```typescript
// Component Pattern
export function ComponentName() {
  const store = useStore();
  return <div className={cn("base", conditional && "extra")}>{content}</div>;
}

// Zustand Store
export const useStore = create<State>()((set) => ({
  value: "",
  setValue: (val) => set({ value: val }),
}));
```

## shadcn/ui Usage
- Install: `npx shadcn@latest add <component>`
- Location: `shared/components/ui/`
- Available: Button, Separator, Dialog, Input, Label, DropdownMenu, ContextMenu, Tooltip, Tabs
- Always use shadcn components, don't create custom UI components

## File Naming
- Components: `kebab-case.tsx`
- Hooks: `use-feature-name.ts`
- Stores: `feature-store.ts`
- Types: `index.ts`

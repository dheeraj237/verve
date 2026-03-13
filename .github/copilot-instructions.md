# GitHub Copilot Instructions — Verve

Follow these concise, repo-specific rules to be productive immediately.

Start sessions with: "Follow COPILOT_GUARDRAILS.md rules"

Purpose
- Help contributors implement features and fixes inside a Vite + React codebase centered on a CodeMirror-powered Markdown editor.

Key facts (what to know first)
- Project uses Vite (see `scripts.dev` -> `vite` in package.json). Run: `yarn dev`.
- Primary UI: React 19 + TypeScript 5, styling via Tailwind CSS 4, UI primitives use shadcn/ui (Radix + Tailwind).
- Editor core: CodeMirror 6 with many custom plugins under `src/features/editor/plugins`.
- State: Zustand stores live under `src/core/store` and feature-level stores under `src/features/*/store`.
- File management: a git-like FileManager in `src/core/file-manager` (autosave debounce ~2s, conflict detection). See docs in `docs/ARCHITECTURE.md`.

Developer workflows & commands
- Install: `yarn install`
- Dev server: `yarn dev` (Vite)
- Build: `yarn build`
- Test: `yarn test` (Jest; uses `--runInBand`)
- Add shadcn component: `yarn shadcn:add` (script provided in package.json)

Project conventions (important and opinionated)
- File/folder layout: feature-based under `src/features/`, shared UI under `src/shared/`, core systems under `src/core/`.
- Naming: components in kebab-case (`my-component.tsx`), hooks `use-feature-name.ts`, stores `feature-store.ts`.
- UI: Prefer shadcn/ui components from `src/shared/components/ui/` — do not invent new global UI systems.
- Styling: Use Tailwind utility classes and CSS variables (no hardcoded colors).
- Plugins: CodeMirror plugins must follow the Decoration/StateField pattern (see examples in `src/features/editor/plugins/*` and docs `docs/ARCHITECTURE.md`). Widgets use `Decoration.replace({ widget })` and `StateField.define` to update on doc/selection changes.

Integration points & external deps
- RxDB is present (see `src/core/rxdb`) — be careful when modifying DB adapters or sync logic.
- File manager talks to storage adapters (local/browser/remote); collision handling is implemented in `src/core/file-manager`.
- Heavy features (Mermaid, KaTeX, CodeMirror plugins) are lazily loaded — prefer lazy imports for size-sensitive work.

Quick implementation checklist for CodeMirror plugin work
1. Add plugin file under `src/features/editor/plugins/`.
2. Implement WidgetType + `buildDecorations(state)` using `syntaxTree` where needed.
3. Register plugin via a `StateField` that rebuilds on `tr.docChanged` or `tr.selection`.
4. Add tests where possible; integration tests live under `tests/integration/`.

Where to look first (key files)
- App entry: `src/main.tsx` and `src/App.tsx`
- Editor shell & plugins: `src/features/editor/` and `src/features/editor/plugins/`
- File manager + adapters: `src/core/file-manager/`
- Cache / Source of truth + Sync manager (using adapters to push, pull, and merge): `src/core/rxdb/` and `src/core/cache/`
- Stores: `src/core/store/` and `src/features/*/store`
- Architecture docs: `docs/ARCHITECTURE.md`

Small, practical guardrails for agents
- always use java doc style comments for functions and classes and only use inline comments for complex logic or non-obvious decisions.
- Do not change project architecture assumptions (feature-based layout) without explicit instruction.
- Preserve shadcn/ui usage and Tailwind variables; add new components into `src/shared/components/ui/` only.
- When changing saving/merge logic, update `docs/ARCHITECTURE.md` and add tests in `tests/integration/`.
- If unsure about server vs local behavior, check `package.json` and `src/core/file-manager` for the canonical flow.

If anything in these instructions is unclear or you want me to expand examples (e.g., a minimal plugin template, test harness, or a checklist for file-manager changes), tell me which section to iterate on.

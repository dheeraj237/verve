"use client";
/**
 * AppLoader
 *
 * Global top progress bar for the application. It displays when any of the
 * following are true:
 * - `useWorkspaceStore().isWorkspaceSwitching` is true (workspace switch flow)
 * - `useLoadingStore().isLoading` is true (HTTP requests or other async tasks)
 *
 * How to use:
 * - HTTP requests: the `PatchFetchClient` (mounted in `App.tsx`) will automatically
 *   increment/decrement the global loading counter for all `fetch` calls.
 * - Workspace switching: the workspace store already toggles `isWorkspaceSwitching`
 *   which the loader listens to automatically.
 * - Custom async tasks: wrap the promise with `runWithLoading(yourAsyncFn)` from
 *   `src/core/loading/run-with-loading.ts` to automatically show the loader while
 *   the task is in-flight. Example:
 *
 *   import { runWithLoading } from '@/core/loading/run-with-loading';
 *   await runWithLoading(() => someAsyncAction());
 *
 * - Manual control: you can also call `useLoadingStore.getState().increment()` and
 *   `useLoadingStore.getState().decrement()` to manage the indicator manually.
 *
 * The component is intentionally client-only and lightweight so it can be dropped
 * into the top-level app layout with minimal code.
 */

import React from 'react';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { useLoadingStore } from '@/core/store/loading-store';

export function AppLoader() {
  const isWorkspaceSwitching = useWorkspaceStore((s) => s.isWorkspaceSwitching);
  const isLoading = useLoadingStore((s) => s.isLoading);

  if (!isWorkspaceSwitching && !isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-primary/20 pointer-events-none">
      <div className="h-full bg-primary animate-progress-indeterminate pointer-events-none" />
    </div>
  );
}

export default AppLoader;

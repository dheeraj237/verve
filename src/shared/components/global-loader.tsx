"use client";
/**
 * GlobalLoader
 *
 * Full-screen overlay loader component that displays:
 * - Blurred backdrop overlay (prevents all interactions)
 * - Spinning loader animation
 * - Custom message text (e.g., "Creating Workspace...", "Switching Workspace...")
 *
 * Usage:
 * 1. Direct API (with custom message):
 *    ```
 *    import { useLoadingStore } from '@/core/store/loading-store';
 *    
 *    const { show, hide } = useLoadingStore.getState();
 *    show('Creating Workspace...');
 *    try {
 *      await someAsyncAction();
 *    } finally {
 *      hide();
 *    }
 *    ```
 *
 * 2. With runWithLoading helper (recommended):
 *    ```
 *    import { runWithLoading } from '@/core/loading/run-with-loading';
 *    await runWithLoading(() => someAsyncAction(), 'Creating Workspace...');
 *    ```
 *
 * The loader automatically shows when `useLoadingStore().isLoading` is true.
 */

import React from 'react';
import { useLoadingStore } from '@/core/store/loading-store';
import { Loader2 } from 'lucide-react';

export function GlobalLoader() {
  const isLoading = useLoadingStore((s) => s.isLoading);
  const message = useLoadingStore((s) => s.message);

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Loader content - directly on background */}
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        {message && (
          <p className="text-lg font-medium text-foreground">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default GlobalLoader;

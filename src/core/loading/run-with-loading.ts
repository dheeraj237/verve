import useLoadingStore from '@/core/store/loading-store';

/**
 * runWithLoading
 * Convenience helper to run an async function while showing the global AppLoader.
 * Usage:
 *   await runWithLoading(() => fetch('/api/...'))
 */
export async function runWithLoading<T>(fn: () => Promise<T>): Promise<T> {
  try {
    useLoadingStore.getState().increment();
    const res = await fn();
    return res;
  } finally {
    // ensure decrement happens after current tick so UI updates reliably
    setTimeout(() => useLoadingStore.getState().decrement(), 0);
  }
}

export default runWithLoading;

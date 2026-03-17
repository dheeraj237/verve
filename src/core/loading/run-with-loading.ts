import useLoadingStore from '@/core/store/loading-store';

/**
 * runWithLoading
 * Convenience helper to run an async function while showing the global GlobalLoader.
 * 
 * @param fn - The async function to execute
 * @param message - Optional custom message to display (e.g., "Creating Workspace...")
 * 
 * Usage:
 *   await runWithLoading(() => fetch('/api/...'), 'Loading data...')
 */
export async function runWithLoading<T>(
  fn: () => Promise<T>,
  message?: string
): Promise<T> {
  try {
    useLoadingStore.getState().show(message);
    const res = await fn();
    return res;
  } finally {
    // ensure hide happens after current tick so UI updates reliably
    setTimeout(() => useLoadingStore.getState().hide(), 0);
  }
}

export default runWithLoading;

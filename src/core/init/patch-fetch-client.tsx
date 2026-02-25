"use client";
import { useEffect } from "react";
import { useLoadingStore } from "@/core/store/loading-store";

// This component patches the global fetch to increment/decrement the loading counter
export function PatchFetchClient() {
  const increment = useLoadingStore((s) => s.increment);
  const decrement = useLoadingStore((s) => s.decrement);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nativeFetch = window.fetch.bind(window);

    // Avoid double-patching
    if ((nativeFetch as any).__patched_for_loading) return;

    const wrappedFetch: typeof window.fetch = async (input: RequestInfo, init?: RequestInit) => {
      increment();
      try {
        const res = await nativeFetch(input, init);
        return res;
      } catch (err) {
        throw err;
      } finally {
        // ensure decrement even on error
        setTimeout(() => decrement(), 0);
      }
    };

    (wrappedFetch as any).__patched_for_loading = true;
    window.fetch = wrappedFetch;

    return () => {
      // restore original fetch on unmount
      try {
        window.fetch = nativeFetch;
      } catch (e) {
        // ignore
      }
    };
  }, [increment, decrement]);

  return null;
}

export default PatchFetchClient;

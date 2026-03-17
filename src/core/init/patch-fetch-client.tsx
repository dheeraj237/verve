"use client";
import { useEffect } from "react";
import { useLoadingStore } from "@/core/store/loading-store";

// This component patches the global fetch to show/hide the loading indicator
export function PatchFetchClient() {
  const show = useLoadingStore((s) => s.show);
  const hide = useLoadingStore((s) => s.hide);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nativeFetch = window.fetch.bind(window);

    // Avoid double-patching
    if ((nativeFetch as any).__patched_for_loading) return;

    const wrappedFetch: typeof window.fetch = async (input: RequestInfo, init?: RequestInit) => {
      show();
      try {
        const res = await nativeFetch(input, init);
        return res;
      } catch (err) {
        throw err;
      } finally {
        // ensure hide even on error
        setTimeout(() => hide(), 0);
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
  }, [show, hide]);

  return null;
}

export default PatchFetchClient;

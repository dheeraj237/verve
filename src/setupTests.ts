// Global teardown to stop background services and close DBs so Jest can exit cleanly
afterAll(async () => {
  try {
    // require lazily so tests can mock these modules per-test if needed
    // eslint-disable-next-line global-require
    const { stopSyncManager } = require('@/core/sync/sync-manager');
    try {
      stopSyncManager();
    } catch (err) {
      // ignore
    }
  } catch (err) {
    // ignore if module not available
  }

  try {
    // eslint-disable-next-line global-require
    const { getCacheDB } = require('@/core/cache/rxdb');
    try {
      const db = getCacheDB();
      if (db && typeof db.destroy === 'function') {
        await db.destroy();
      }
    } catch (err) {
      // ignore
    }
  } catch (err) {
    // ignore if module not available or mocked
  }
});

// Debugging helpers were removed to keep test output clean.

// Log unhandled rejections during tests to help diagnose failures
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('UnhandledRejection during tests:', reason);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('UncaughtException during tests:', err);
  throw err;
});

// Provide an in-memory `localStorage` and `sessionStorage` shim for Jest tests
// to satisfy `zustand` persist middleware which warns when storage is unavailable.
if (typeof (global as any).localStorage === 'undefined') {
  const createMemoryStorage = () => {
    let store: Record<string, string> = {};
    return {
      getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem(key: string, value: string) {
        store[key] = String(value);
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        store = {};
      },
    };
  };

  // Attach to both global and a `window` global (Node env) so `zustand`'s
  // `persist` middleware can access `window.localStorage` without throwing.
  const memoryStorage = createMemoryStorage();
  try {
    (global as any).localStorage = memoryStorage;
    (global as any).sessionStorage = createMemoryStorage();
    if (typeof (global as any).window === 'undefined') {
        // Create a minimal `window` object in Node test environment
        (global as any).window = {};
    }
      (global as any).window.localStorage = (global as any).localStorage;
      (global as any).window.sessionStorage = (global as any).sessionStorage;
      // Ensure minimal EventTarget APIs exist for code that listens to custom events
      if (typeof (global as any).window.addEventListener !== 'function') {
        const listeners: Record<string, Set<Function>> = {};
        (global as any).window.addEventListener = (type: string, cb: Function) => {
          listeners[type] = listeners[type] || new Set();
          listeners[type].add(cb);
        };
        (global as any).window.removeEventListener = (type: string, cb: Function) => {
          if (!listeners[type]) return;
          listeners[type].delete(cb);
        };
        (global as any).window.dispatchEvent = (event: any) => {
          const set = listeners[event?.type];
          if (!set) return;
          for (const cb of Array.from(set)) {
            try { cb.call(global, event); } catch (e) { /* ignore */ }
          }
        };
      }
  } catch (e) {
    // ignore in case globals are locked
  }
}

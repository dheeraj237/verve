// Integration test setup: ensure fake IndexedDB is available and start from
// a clean database state to avoid duplicate DB errors between tests.
try {
  // Ensure fake-indexeddb is loaded (defines global indexedDB)
  // eslint-disable-next-line global-require
  require('fake-indexeddb/auto');
} catch (e) {
  // best-effort; if unavailable the integration project will still fail
}

// Keep this file minimal; do not set environment flags here – storage selection
// is handled by `src/core/rxdb/rxdb-client.ts` at runtime.

if (typeof indexedDB !== 'undefined' && typeof indexedDB.deleteDatabase === 'function') {
  // Delete any existing DB named 'verve' to avoid DB8 duplicate errors
  try {
    // Some implementations return a request; swallow errors
    indexedDB.deleteDatabase('verve');
  } catch (_) { }
}

// Export nothing; this file is executed for side-effects by Jest `setupFiles`.

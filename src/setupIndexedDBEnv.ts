// Load a fake IndexedDB implementation early (runs before Jest env).
// Keep this file minimal and free of Jest globals so it can be used from
// `jest.config.cjs` `setupFiles` which execute before the test framework.
try {
  require('fake-indexeddb/auto');
} catch (err) {
  // If fake-indexeddb isn't available, tests that need IndexedDB will fail
  // later — swallow the error to keep other tests runnable.
}

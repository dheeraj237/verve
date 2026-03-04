// Ensure integration tests use the real rxdb-client implementation
// This file runs in Jest's `setupFilesAfterEnv` for the `integration` project
// so `jest.unmock` is available and will apply before test modules are imported.

// Unmock the client so integration tests exercise the real RxDB-backed code
// while the `unit` project continues to map the client to a lightweight mock.
try {
  // eslint-disable-next-line no-undef
  jest.unmock('@/core/rxdb/rxdb-client');
} catch (err) {
  // If jest is not available for some reason, fail softly.
  // Tests will still run; individual test files may include their own `jest.unmock`.
}

// Add afterEach hook to clean up RxDB after each test to prevent stale connections
// and migration version mismatches. This must be done synchronously at setup time.
// eslint-disable-next-line no-undef
afterEach(async () => {
  try {
    // Import and call destroy dynamically to avoid circular dependencies
    // eslint-disable-next-line global-require
    const { destroyRxDB } = require('@/core/rxdb/rxdb-client');
    if (typeof destroyRxDB === 'function') {
      await destroyRxDB();
    }
  } catch (_) {
    // Ignore cleanup errors; tests may fail for other reasons
  }
});

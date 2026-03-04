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

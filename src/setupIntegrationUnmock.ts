// Ensure integration tests use the real rxdb-client implementation
// This file runs in Vitest's `setupFiles` for integration tests
// so `vi.unmock` is available and will apply before test modules are imported.

import { vi } from 'vitest';

// Unmock the client so integration tests exercise the real RxDB-backed code
// while the unit tests continue to use the lightweight mock.
vi.unmock('@/core/rxdb/rxdb-client');

/**
 * Core sync orchestration module — v2
 * Simplified adapter + SyncManager architecture.
 */

// Core manager
export { SyncManager, getSyncManager, stopSyncManager, SyncStatus } from './sync-manager';

// Adapter interface + implementations
export type { IAdapter } from './adapter';
export { LocalAdapter, BrowserAdapter, PermissionError } from './adapters';

// Handle store (exposed for workspace deletion cleanup)
export { removeHandle } from './handle-store';

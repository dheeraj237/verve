/**
 * Adapter capability interfaces and canonical file descriptor
 * Purpose: smaller, focused interfaces for adapter capabilities.
 */
import type { FileNode } from "@/shared/types";
import type {
  AdapterState,
  AdapterInitError,
  AdapterInitContext,
  AdapterConfig,
  AdapterLifecycleEvent,
  AdapterEventListener,
  AdapterReadinessInfo,
} from "./types/adapter-lifecycle";

export type AdapterFileDescriptor = {
  id: string;
  path: string;
  metadata?: Record<string, any>;
};

export interface IPushAdapter {
  name: string;
  push(file: AdapterFileDescriptor, content: string): Promise<boolean>;
}

export interface IPullAdapter {
  name: string;
  pull(fileId: string, localVersion?: number): Promise<string | null>;
}

export interface IWatchableAdapter {
  watch?(): import('rxjs').Observable<string>;
}

export interface IWorkspaceAdapter {
  listWorkspaceFiles?(workspaceId?: string, path?: string): Promise<{ id: string; path: string; metadata?: any }[]>;
  pullWorkspace?(workspaceId?: string, path?: string): Promise<Array<{ id: string; path: string; metadata?: Record<string, any> }>>;
}

export interface IRemoteOps {
  exists?(fileId: string): Promise<boolean>;
  delete?(fileId: string): Promise<boolean>;
}

// DEPRECATED: Use adapter.getReadinessInfo().isReady instead
export interface IAvailability {
  /**
   * @deprecated Use getReadinessInfo() instead for full state visibility
   * Return true when the adapter is ready to perform I/O (e.g., initialized
   * with credentials or directory handle). If absent, callers should assume
   * the adapter may be available.
   */
  isReady?(): boolean;
}

/**
 * Lifecycle interface: All adapters must implement these methods
 * to participate in the strict state machine.
 *
 * Java-style: These are NON-OPTIONAL contract methods.
 */
export interface IAdapterLifecycle {
  /**
   * Get the current immutable state of this adapter.
   * Reactors can subscribe to state changes via addEventListener().
   */
  getState(): AdapterState;

  /**
   * Get the last initialization error, if any.
   * Non-null only when state === ERRORED.
   */
  getError(): AdapterInitError | null;

  /**
   * Get comprehensive readiness snapshot (immutable).
   * Prefer this over legacy isReady() for full state visibility.
   */
  getReadinessInfo(): AdapterReadinessInfo;

  /**
   * Initialize the adapter with context (directory handle, credentials, etc.).
   * This may be async (e.g., restore from permissionless handle).
   *
   * State transitions: UNINITIALIZED -> INITIALIZING -> READY or ERRORED
   *
   * Does NOT throw; instead emits 'initialization-failed' event.
   * Caller should listen to state changes to detect success/failure.
   */
  initialize(context: AdapterInitContext): Promise<void>;

  /**
   * Clean up resources and transition to DESTROYING -> DESTROYED.
   * Called when workspace is destroyed or adapter is being unregistered.
   * After this, adapter is no longer usable.
   */
  destroy(): Promise<void>;

  /**
   * Stricter readiness check than legacy isReady().
   * Returns true ONLY if state === READY and all invariants are verified.
   *
   * Synchronous; safe to call from hot loops (caches result).
   */
  validateReady(): boolean;

  /**
   * Register a listener for adapter lifecycle events.
   * Events: 'state-changed', 'initialization-failed', 'ready'
   */
  addEventListener(listener: AdapterEventListener): void;

  /**
   * Remove a listener (by reference).
   */
  removeEventListener(listener: AdapterEventListener): void;
}

/*
 * Backwards-compatible composite. Existing code can still import ISyncAdapter
 * while we transition callers to smaller capability interfaces.
 *
 * ISyncAdapter now extends IAdapterLifecycle to enforce lifecycle contract.
 */
export type ISyncAdapter = IPushAdapter &
  IPullAdapter &
  IAdapterLifecycle &
  Partial<IWatchableAdapter & IWorkspaceAdapter & IRemoteOps & IAvailability> & {
    name: string;
  };

// Helper to adapt a FileNode to AdapterFileDescriptor
export function toAdapterDescriptor(file: FileNode): AdapterFileDescriptor {
  return { id: file.id, path: file.path, metadata: file.metadata || undefined };
}

/**
 * Re-export lifecycle types for convenience.
 * Callers can do: import { AdapterState, AdapterInitError } from './adapter-types'
 */
export type {
  AdapterState,
  AdapterInitError,
  AdapterInitContext,
  AdapterConfig,
  AdapterLifecycleEvent,
  AdapterEventListener,
  AdapterReadinessInfo,
} from "./types/adapter-lifecycle";

export { AdapterErrorCode } from "./types/adapter-lifecycle";

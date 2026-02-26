/**
 * Adapter capability interfaces and canonical file descriptor
 * Purpose: smaller, focused interfaces for adapter capabilities.
 */
import type { CachedFile } from "@/core/cache/types";

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
  pullWorkspace?(workspaceId?: string, path?: string): Promise<Array<{ fileId: string; content: string }>>;
}

export interface IRemoteOps {
  exists?(fileId: string): Promise<boolean>;
  delete?(fileId: string): Promise<boolean>;
}

/*
 * Backwards-compatible composite. Existing code can still import ISyncAdapter
 * while we transition callers to smaller capability interfaces.
 */
export type ISyncAdapter = IPushAdapter & IPullAdapter & Partial<IWatchableAdapter & IWorkspaceAdapter & IRemoteOps> & { name: string };

// Helper to adapt a CachedFile to AdapterFileDescriptor
export function toAdapterDescriptor(cached: CachedFile): AdapterFileDescriptor {
  return { id: cached.id, path: cached.path, metadata: cached.metadata };
}

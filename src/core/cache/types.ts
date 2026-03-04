import type { FileNode as SharedFileNode } from '../../shared/types';

// Re-export enums from shared types location
export { FileType, WorkspaceType } from '../../shared/types';

/**
 * DEPRECATED: Use FileNode from src/shared/types instead
 * Kept for backward compatibility during transition
 * Type is still compatible as it's an alias to the unified FileNode
 */
export type CachedFile = SharedFileNode;

export enum SyncOp {
  Put = 'put',
  Delete = 'delete',
}

export type SyncQueueEntry = {
  id: string;
  op: SyncOp;
  target: 'file';
  targetId: string;
  payload?: any;
  attempts?: number;
};

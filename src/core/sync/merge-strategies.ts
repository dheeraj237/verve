import type { CachedFile } from '@/core/cache/types';
import { upsertCachedFile, getCachedFile } from '@/core/cache/file-manager';

export interface MergeStrategy {
  handlePull(cached: CachedFile, remoteContent: string): Promise<'noop' | 'merged' | 'conflict'>;
}

/**
 * NoOp strategy: do not overwrite local content. Record remote versions on the
 * cached file metadata for later inspection.
 */
export class NoOpMergeStrategy implements MergeStrategy {
  async handlePull(cached: CachedFile, remoteContent: string): Promise<'noop' | 'merged' | 'conflict'> {
    try {
      const existing = await getCachedFile(cached.id, cached.workspaceId);
      const meta = existing?.metadata || {};
      const versions = (meta.remoteVersions || []) as Array<{ ts: number; content: string }>;
      versions.push({ ts: Date.now(), content: remoteContent });
      meta.remoteVersions = versions;
      await upsertCachedFile({ ...cached, metadata: meta });
      return 'noop';
    } catch (err) {
      console.warn('NoOpMergeStrategy failed to record remote version:', err);
      return 'noop';
    }
  }
}

/**
 * Placeholder for a Three-Way merge strategy. Not implemented yet.
 */
export class ThreeWayMergeStrategy implements MergeStrategy {
  async handlePull(_cached: CachedFile, _remoteContent: string): Promise<'noop' | 'merged' | 'conflict'> {
    // TODO: implement real three-way merge using base/common/remote
    return 'conflict';
  }
}

export default NoOpMergeStrategy;

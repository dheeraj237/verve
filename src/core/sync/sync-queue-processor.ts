import { v4 as uuidv4 } from 'uuid';
import { defaultRetryPolicy } from './retry-policy';
import type { AdapterFileDescriptor, ISyncAdapter } from './adapter-types';
import { toAdapterDescriptor } from './adapter-types';
import { getCacheDB } from '@/core/cache/rxdb';
import { getCachedFile, markCachedFileAsSynced } from '@/core/cache/rxdb';
import type { CachedFile } from '@/core/cache/types';

export type SyncQueueEntry = {
  id: string;
  op: 'put' | 'delete';
  target: 'file';
  targetId: string;
  payload?: any;
  attempts?: number;
  createdAt: number;
};

/**
 * Enqueue a sync operation into the durable `sync_queue` collection.
 */
export async function enqueueSyncEntry(entry: Partial<SyncQueueEntry> & { op: 'put' | 'delete'; target: 'file'; targetId: string; payload?: any }): Promise<string> {
  const db = getCacheDB();
  const id = (entry && (entry as any).id) || uuidv4();
  const now = Date.now();
  const doc: SyncQueueEntry = {
    id,
    op: entry.op,
    target: 'file',
    targetId: entry.targetId,
    payload: entry.payload || null,
    attempts: 0,
    createdAt: now,
  };
  await db.sync_queue.upsert(doc);
  return id;
}

/**
 * Process pending entries in the `sync_queue` once.
 * - entries with attempts >= maxAttempts are skipped
 * - on success the entry is removed
 * - on failure attempts is incremented
 *
 * The `adapters` map is used to perform the actual push operations. The
 * processor will attempt adapters in insertion order until one succeeds.
 */
export async function processPendingQueueOnce(adapters: Map<string, ISyncAdapter>, maxAttempts = 3): Promise<void> {
  const db = getCacheDB();
  try {
    const docs = await db.sync_queue.find({ selector: { attempts: { $lt: maxAttempts } } }).sort({ createdAt: 'asc' }).exec();
    for (const d of docs) {
      const entry = d.toJSON() as SyncQueueEntry;
      try {
        if (entry.target !== 'file') {
          // currently only file targets supported
          await d.remove();
          continue;
        }

        // Resolve cached file (may be missing for deletes)
        const cached: CachedFile | null = await getCachedFile(entry.targetId);

        // Build descriptor if available
        const descriptor: AdapterFileDescriptor | null = cached ? toAdapterDescriptor(cached) : null;

        let success = false;
        // Attempt adapters
        for (const adapter of adapters.values()) {
          try {
            if (entry.op === 'put') {
              if (!descriptor) break; // nothing to push
              success = await (adapter.push as any)(descriptor, cached?.content || '');
            } else if (entry.op === 'delete') {
              success = await (adapter.delete as any)(entry.targetId);
            }
            if (success) break;
          } catch (err) {
            // swallow adapter error and try next
            console.warn('Adapter push error in queue processor:', err);
          }
        }

        if (success) {
          // Mark synced and remove queue entry
          if (entry.op === 'put') {
            try {
              await markCachedFileAsSynced(entry.targetId);
            } catch (e) {
              console.warn('Failed to mark cached file as synced after queue success', e);
            }
          }
          await d.remove();
        } else {
          // Increment attempts
          const next = (entry.attempts || 0) + 1;
          await d.patch({ attempts: next });
          // Optionally wait according to retry policy before continuing to next entry
          await defaultRetryPolicy.waitForAttempt(next);
        }
      } catch (err) {
        console.error('Failed to process queue entry:', entry.id, err);
        // Increment attempts defensively
        try {
          const next = (entry.attempts || 0) + 1;
          await d.patch({ attempts: next });
        } catch (_) {
          // ignore
        }
      }
    }
  } catch (error) {
    console.error('processPendingQueueOnce failed:', error);
    throw error;
  }
}

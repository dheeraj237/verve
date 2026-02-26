import type { CachedFile } from '@/core/cache/types';
import { toAdapterDescriptor, AdapterFileDescriptor } from '@/core/sync/adapter-types';

/**
 * Small bridge helpers to translate between cache model and adapter descriptor.
 */
export function fromCachedFile(cached: CachedFile): AdapterFileDescriptor {
  return toAdapterDescriptor(cached);
}

export default {
  fromCachedFile,
};

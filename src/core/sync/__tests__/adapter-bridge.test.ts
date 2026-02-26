import { fromCachedFile } from '@/core/sync/adapter-bridge';
import type { CachedFile } from '@/core/cache/types';

describe('adapter-bridge', () => {
  test('maps CachedFile to AdapterFileDescriptor correctly', () => {
    const sample: CachedFile = {
      id: 'file-1',
      name: 'file.md',
      path: '/notes/file.md',
      type: 'file',
      workspaceType: 'gdrive',
      metadata: { driveId: 'drive-123' },
      content: 'hello',
    };

    const desc = fromCachedFile(sample);
    expect(desc.id).toBe(sample.id);
    expect(desc.path).toBe(sample.path);
    expect(desc.metadata?.driveId).toBe('drive-123');
  });
});

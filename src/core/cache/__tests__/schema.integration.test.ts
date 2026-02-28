import 'fake-indexeddb/auto';
import { initFileOps, destroyCacheDB } from '@/tests/helpers/test-utils';
import { WorkspaceType, FileType } from '@/core/cache/types';

describe('cached_files schema compatibility', () => {
  beforeEach(async () => {
    jest.resetModules();
    await initFileOps();
  });

  afterAll(async () => {
    await destroyCacheDB();
  });

  it('accepts documents with lastModified and metadata fields', async () => {
    const { upsertCachedFile, getCachedFile } = await import('@/core/cache/rxdb');

    const file = {
      id: 'test-file-1',
      name: 'test.md',
      path: '/test.md',
      type: FileType.File,
      workspaceType: WorkspaceType.Browser,
      workspaceId: 'ws-test',
      content: 'hello world',
      lastModified: Date.now(),
      metadata: { custom: 'meta' },
      dirty: false,
    } as any;

    // Should not throw
    await expect(upsertCachedFile(file)).resolves.toBeUndefined();

    const loaded = await getCachedFile('test-file-1');
    expect(loaded).toBeDefined();
    expect(loaded?.lastModified).toBeDefined();
    expect(loaded?.metadata).toBeDefined();
    expect(loaded?.metadata?.custom).toBe('meta');
  });
});

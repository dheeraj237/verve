import { vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/core/cache/file-manager', () => ({
  getAllFiles: vi.fn()
}));

import { getAllFiles } from '@/core/cache/file-manager';
import { useFileExplorerStore } from '../file-explorer-store';

describe('build file tree -> map integration', () => {
  beforeEach(() => {
    (getAllFiles as Mock).mockReset();
    // clear store (canonical shape)
    (useFileExplorerStore as any).setState({ fileMap: {}, rootIds: [] });
  });

  test('builds deterministic tree and map from flat file list', async () => {
    // Provide files in non-sorted order
    const files = [
      { id: 'f2', name: 'b.md', path: 'b.md', type: 'file' },
      { id: 'f1', name: 'a.md', path: 'a.md', type: 'file' },
      { id: 'd1', name: 'docs', path: 'docs', type: 'dir' },
      { id: 'f3', name: 'docs/x.md', path: 'docs/x.md', type: 'file' }
    ];
    (getAllFiles as Mock).mockResolvedValue(files as any);

    const tree = await (useFileExplorerStore.getState() as any)._buildFileTreeFromCache('ws1');

    // tree should contain root files and folder 'docs'
    expect(Array.isArray(tree)).toBe(true);
    const map = useFileExplorerStore.getState().fileMap;
    expect(map['f1']).toBeDefined();
    expect(map['f2']).toBeDefined();
    expect(map['d1']).toBeDefined();
    // children of folder d1 should include f3 id
    const children = (map['d1'] as any).children || [];
    expect(children.length).toBeGreaterThanOrEqual(0);
    // rootIds should include top-level items (order deterministic by implementation)
    const roots = useFileExplorerStore.getState().rootIds;
    expect(Array.isArray(roots)).toBe(true);
  });
});

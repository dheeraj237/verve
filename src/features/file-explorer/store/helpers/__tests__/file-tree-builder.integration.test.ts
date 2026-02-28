import { buildFileTreeFromAdapter } from '../file-tree-builder';
import { WorkspaceType } from '@/core/cache/types';

jest.mock('@/core/cache/file-operations', () => ({
  getAllFiles: jest.fn(async (workspaceId: string | undefined) => [
    { id: '1', name: 'verve.md', path: 'verve.md', type: 'file', workspaceType: WorkspaceType.Browser, workspaceId },
    { id: '2', name: 'ROOOT.md', path: 'verve.md/ROOOT.md', type: 'file', workspaceType: WorkspaceType.Browser, workspaceId },
    { id: '3', name: 'rooot.md', path: 'verve.md/rooot.md', type: 'file', workspaceType: WorkspaceType.Browser, workspaceId },
  ])
}));

describe('file tree builder integration - file vs folder conflict', () => {
  it('converts file to folder when nested paths exist and preserves the original file as a child', async () => {
    const nodes = await buildFileTreeFromAdapter(null, '', '', WorkspaceType.Browser, 'ws-1');

    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    expect(node.type).toBe('folder');
    expect(node.name).toBe('verve.md');
    expect(node.children).toBeDefined();

    const childNames = node.children!.map((c: any) => c.name);
    expect(childNames).toEqual(expect.arrayContaining(['ROOOT.md', 'rooot.md', 'verve.md']));
  });
});

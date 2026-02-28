import { useFileExplorerStore } from '../file-explorer-store';

describe('file-explorer store selectors', () => {
  beforeEach(() => {
    // reset store state
    const set = (useFileExplorerStore as any).setState;
    set({ fileMap: {}, rootIds: [], fileTree: [] });
  });

  test('getChildren returns child ids array or empty', () => {
    const state = useFileExplorerStore.getState();
    // seed fileMap
    const sample = {
      'root-1': { id: 'root-1', name: 'root', path: '/', type: 'directory', children: ['child-1', 'child-2'] },
      'child-1': { id: 'child-1', name: 'a.md', path: '/a.md', type: 'file' },
      'child-2': { id: 'child-2', name: 'b.md', path: '/b.md', type: 'file', dirty: true }
    } as any;
    (useFileExplorerStore as any).setState({ fileMap: sample, rootIds: ['root-1'] });

    expect(state.getChildren('root-1')).toEqual(['child-1', 'child-2']);
    expect(state.getChildren('child-1')).toEqual([]);
  });

  test('getPath returns path or null', () => {
    const state = useFileExplorerStore.getState();
    (useFileExplorerStore as any).setState({ fileMap: { 'x': { id: 'x', path: '/x' } } });
    expect(state.getPath('x')).toBe('/x');
    expect(state.getPath('nope')).toBeNull();
  });

  test('isDirty reads dirty flag from fileMap', () => {
    const state = useFileExplorerStore.getState();
    (useFileExplorerStore as any).setState({ fileMap: { 'd1': { id: 'd1', dirty: true }, 'd2': { id: 'd2' } } });
    expect(state.isDirty('d1')).toBe(true);
    expect(state.isDirty('d2')).toBe(false);
    expect(state.isDirty('missing')).toBe(false);
  });
});

import { adapterEntryToCachedFile } from '../adapter-normalize';
import { WorkspaceType } from '@/core/cache/types';

describe('adapterEntryToCachedFile', () => {
  test('converts gdrive-like entry to cached file with metadata', () => {
    const entry = {
      id: 'g1',
      path: 'docs/notes.md',
      metadata: { id: 'g1', name: 'notes.md', mimeType: 'text/markdown', modifiedTime: '2024-01-01T12:00:00Z', size: 123 }
    };

    const out = adapterEntryToCachedFile(entry, WorkspaceType.GDrive, 'ws-1');
    expect(out.id).toBe('g1');
    expect(out.path).toBe('docs/notes.md');
    expect(out.name).toBe('notes.md');
    expect(out.meta).toBeDefined();
    expect(out.size).toBe(123);
    expect(out.dirty).toBe(false);
    expect(out.synced).toBe(true);
  });

  test('detects folders when mimeType indicates folder', () => {
    const entry = { id: 'f1', path: 'docs', metadata: { name: 'docs', mimeType: 'application/vnd.google-apps.folder' } };
    const out = adapterEntryToCachedFile(entry, WorkspaceType.GDrive, 'ws-1');
    expect(out.type).toBeDefined();
    expect(out.type).toEqual(expect.any(String));
    // Directory should use FileType.Dir which maps to 'directory'
    expect(out.type).toBe('directory');
  });
});

import { migrationStrategies } from '../schemas';

describe('cachedFile migration to v3', () => {
  test('migrates legacy fields to canonical FileNode shape', () => {
    const legacy = {
      id: 'old1',
      name: 'notes',
      path: '/notes',
      type: 'dir',
      workspaceType: 'browser',
      metadata: { foo: 'bar' },
      lastModified: 1670000000000,
      dirty: true
    };

    const migrated = migrationStrategies.cachedFile[3](legacy as any);

    expect(migrated.type).toBe('directory');
    expect(migrated.meta).toBeDefined();
    expect(migrated.meta.foo).toBe('bar');
    expect(typeof migrated.modifiedAt).toBe('string');
    expect(migrated.createdAt).toBeDefined();
    expect(migrated.workspaceId === null || typeof migrated.workspaceId === 'string').toBe(true);
    expect(Array.isArray(migrated.children)).toBe(true);
    expect(migrated.synced).toBe(false);
  });
});

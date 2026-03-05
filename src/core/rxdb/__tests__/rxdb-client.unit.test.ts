import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Use real RxDB client for this test
vi.unmock('@/core/rxdb/rxdb-client');

import { createRxDB, upsertDoc, getDoc, findDocs, subscribeDoc } from '../rxdb-client';
import type { FileDoc } from '../schemas';

beforeEach(async () => {
  await createRxDB();
});

test('upsert and get file doc', async () => {
  const doc: FileDoc = {
    id: 'w1:/a.md',
    workspaceId: 'w1',
    workspaceType: 'Local',
    path: '/a.md',
    name: 'a.md',
    content: 'hello',
    dirty: false,
    lastModified: Date.now(),
    version: 1
  };

  await upsertDoc('files', doc);
  const got = await getDoc<FileDoc>('files', doc.id);
  expect(got).not.toBeNull();
  expect(got!.content).toBe('hello');
});

test('findDocs by workspaceId', async () => {
  const docs = await findDocs<FileDoc>('files', { selector: { workspaceId: 'w1' } });
  expect(Array.isArray(docs)).toBe(true);
});

test('subscribeDoc receives updates', async () => {
  const id = 'w1:/b.md';
  const doc: FileDoc = {
    id,
    workspaceId: 'w1',
    workspaceType: 'Local',
    path: '/b.md',
    name: 'b.md',
    content: 'init',
    dirty: false,
    lastModified: Date.now(),
    version: 1
  };

  await upsertDoc('files', doc);

  await new Promise<void>(async (resolve) => {
    const unsub = subscribeDoc<FileDoc>('files', id, (d) => {
      if (d && d.content === 'updated') {
        unsub();
        resolve();
      }
    });

    // trigger update
    await upsertDoc('files', { ...doc, content: 'updated' });
  });
});

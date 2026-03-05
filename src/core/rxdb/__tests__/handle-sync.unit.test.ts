import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Use real RxDB client for this test
vi.unmock('@/core/rxdb/rxdb-client');

import { createRxDB, getDoc } from '@/core/rxdb/rxdb-client';
import { storeHandleForWorkspace, getHandleMeta } from '@/core/rxdb/handle-sync';

describe('handle-sync', () => {
  beforeEach(async () => {
    await createRxDB();
  });

  test('stores directoryHandle in directory_handles_meta', async () => {
    // Use a serializable handle-like object so fake-indexeddb can clone it.
    const fakeHandle: any = {
      name: 'root'
    };

    await storeHandleForWorkspace('ws-test', fakeHandle as any);

    const meta = await getHandleMeta('ws-test');
    expect(meta).not.toBeNull();
    const doc: any = meta as any;
    expect(doc.directoryName).toBe('root');
    // directoryHandle should be present and include the original name
    expect((doc as any).directoryHandle).toBeDefined();
    expect((doc as any).directoryHandle.name).toBe('root');
  });
});

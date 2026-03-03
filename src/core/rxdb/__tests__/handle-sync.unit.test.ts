import { createRxDB, getDoc } from '@/core/rxdb/rxdb-client';
import { storeHandleForWorkspace, getHandleMeta } from '@/core/rxdb/handle-sync';

describe('handle-sync', () => {
  beforeEach(async () => {
    try { await createRxDB(); } catch (e) { /* best-effort */ }
  });

  test('stores directoryHandle in directory_handles_meta', async () => {
    const fakeHandle: any = {
      name: 'root',
      queryPermission: jest.fn(async () => 'granted'),
      requestPermission: jest.fn(async () => 'granted')
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

// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { getHandle, setHandle, removeHandle } from '../handle-store';

/** Minimal stub that satisfies the FileSystemDirectoryHandle shape needed for structured-clone roundtrip. */
function makeHandle(name = 'test-dir'): FileSystemDirectoryHandle {
  return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle;
}

describe('HandleStore', () => {
  // Each test gets its own workspace id so they don't interfere
  let wsId: string;
  beforeEach(() => {
    wsId = `ws-${Math.random().toString(36).slice(2)}`;
  });

  it('returns null for unknown workspaceId', async () => {
    const result = await getHandle(wsId);
    expect(result).toBeNull();
  });

  it('roundtrips a handle: setHandle → getHandle returns equivalent object', async () => {
    const handle = makeHandle('my-dir');
    await setHandle(wsId, handle);
    const retrieved = await getHandle(wsId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('my-dir');
    expect(retrieved?.kind).toBe('directory');
  });

  it('overwrites existing handle on second setHandle', async () => {
    await setHandle(wsId, makeHandle('first'));
    await setHandle(wsId, makeHandle('second'));
    const retrieved = await getHandle(wsId);
    expect(retrieved?.name).toBe('second');
  });

  it('removeHandle then getHandle returns null', async () => {
    await setHandle(wsId, makeHandle());
    await removeHandle(wsId);
    const result = await getHandle(wsId);
    expect(result).toBeNull();
  });

  it('removeHandle is a no-op for non-existent key', async () => {
    await expect(removeHandle(wsId)).resolves.toBeUndefined();
  });
});

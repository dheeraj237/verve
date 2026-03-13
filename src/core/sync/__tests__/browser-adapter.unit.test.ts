import { describe, it, expect } from 'vitest';
import { BrowserAdapter } from '../adapters/browser-adapter';

describe('BrowserAdapter', () => {
  const adapter = new BrowserAdapter('ws-browser');

  it('has correct workspaceId and type', () => {
    expect(adapter.workspaceId).toBe('ws-browser');
    expect(adapter.type).toBe('browser');
  });

  it('pull() resolves without error', async () => {
    await expect(adapter.pull()).resolves.toBeUndefined();
  });

  it('push() resolves without error', async () => {
    await expect(adapter.push('notes.md', 'content')).resolves.toBeUndefined();
  });

  it('ensurePermission() resolves to true', async () => {
    await expect(adapter.ensurePermission()).resolves.toBe(true);
  });

  it('shouldIncludeFile() always returns true', () => {
    expect(adapter.shouldIncludeFile('any.exe', 'any.exe', 1e9)).toBe(true);
    expect(adapter.shouldIncludeFile('.DS_Store', '.DS_Store', 0)).toBe(true);
  });

  it('shouldIncludeFolder() always returns true', () => {
    expect(adapter.shouldIncludeFolder('node_modules')).toBe(true);
    expect(adapter.shouldIncludeFolder('.git')).toBe(true);
  });

  it('destroy() is a no-op', () => {
    expect(() => adapter.destroy()).not.toThrow();
  });
});

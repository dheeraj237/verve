/**
 * Simple localStorage manager for small metadata flags.
 *
 * Note: File system handles cannot be reliably serialized into localStorage.
 * We store only primitive metadata here (strings, timestamps) when needed.
 */

const PREFIX = 'verve.local.';

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch (e) {
    console.warn('local-storage-manager.setItem failed', e);
  }
}

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch (e) {
    console.warn('local-storage-manager.getItem failed', e);
    return null;
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    console.warn('local-storage-manager.removeItem failed', e);
  }
}

export function clearAll(): void {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    });
  } catch (e) {
    console.warn('local-storage-manager.clearAll failed', e);
  }
}

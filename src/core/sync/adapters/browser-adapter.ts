import { Observable } from 'rxjs';
import { ISyncAdapter } from '../sync-manager';
import type { CachedFile } from '../../cache/types';

/**
 * Browser storage adapter
 * Syncs files using browser APIs like Fetch, FileSystem Access API, etc.
 */
export class BrowserAdapter implements ISyncAdapter {
  name = 'browser';

  private endpoint = '/api/files'; // Default endpoint, can be customized

  constructor(endpoint?: string) {
    if (endpoint) {
      this.endpoint = endpoint;
    }
  }

  async push(file: CachedFile, yjsState: Uint8Array): Promise<boolean> {
    try {
      // TODO: Implement HTTP POST/PUT to backend
      // Send file metadata and Yjs state as multipart form data or JSON
      const response = await fetch(`${this.endpoint}/${file.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: file.name,
          path: file.path,
          yjsState: Buffer.from(yjsState).toString('base64'),
          lastModified: file.lastModified
        })
      });

      return response.ok;
    } catch (error) {
      console.error('BrowserAdapter push error:', error);
      return false;
    }
  }

  async pull(fileId: string, localVersion?: number): Promise<Uint8Array | null> {
    try {
      // TODO: Implement HTTP GET from backend
      // Pass version/ETag to check if remote has newer version
      const params = new URLSearchParams();
      if (localVersion !== undefined) {
        params.append('since', String(localVersion));
      }

      const response = await fetch(`${this.endpoint}/${fileId}?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 304) {
          return null; // Not modified
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.yjsState) {
        return new Uint8Array(Buffer.from(data.yjsState, 'base64'));
      }

      return null;
    } catch (error) {
      console.error('BrowserAdapter pull error:', error);
      return null;
    }
  }

  async exists(fileId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/${fileId}`, {
        method: 'HEAD'
      });
      return response.ok;
    } catch (error) {
      console.error('BrowserAdapter exists error:', error);
      return false;
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/${fileId}`, {
        method: 'DELETE'
      });
      return response.ok;
    } catch (error) {
      console.error('BrowserAdapter delete error:', error);
      return false;
    }
  }

  watch?(): Observable<string> {
    // TODO: Implement WebSocket or Server-Sent Events for real-time updates
    return new Observable((subscriber) => {
      // Use WebSocket or SSE to listen for changes
      // Emit fileIds when changes are detected
    });
  }
}

import { Observable, Subject, timer } from 'rxjs';
import type { CachedFile } from '@/core/cache/types';
import type { AdapterFileDescriptor, IPushAdapter, IPullAdapter } from '@/core/sync/adapter-types';
import { toAdapterDescriptor } from '@/core/sync/adapter-types';

/**
 * Google Drive adapter
 * Syncs files with Google Drive using the Google Drive API
 * Requires Google API client authorization
 */
export class GDriveAdapter implements IPushAdapter, IPullAdapter {
  name = 'gdrive';
  private eTagCache = new Map<string, string>(); // Track ETags for change detection
  private changeNotifier = new Subject<string>();

  constructor(private driveClient?: any) {
    if (!driveClient) {
      console.warn('GDriveAdapter: No drive client provided. Initialize with authenticated client.');
    }
  }

  /**
   * Push local changes to Google Drive
   */
  async push(file: AdapterFileDescriptor | CachedFile, content: string): Promise<boolean> {
    // Accept both the new AdapterFileDescriptor and legacy CachedFile for compatibility
    const descriptor: AdapterFileDescriptor = (('path' in file && 'id' in file) ? (file as AdapterFileDescriptor) : toAdapterDescriptor(file as CachedFile));
    const context = `${this.name}::push(${descriptor.id})`;
    try {
      if (!this.driveClient) {
        console.error(`${context}: Drive client not initialized`);
        return false;
      }

      const driveId = descriptor.metadata?.driveId;
      if (!driveId) {
        console.error(`${context}: No driveId in file metadata`);
        return false;
      }

      try {
        // Create blob from string content
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

        // TODO: Implement actual Google Drive API call
        // const response = await this.driveClient.files.update({
        //   fileId: driveId,
        //   media: { body: blob },
        //   fields: 'id, etag, modifiedTime'
        // });
        //
        // if (response.status === 200) {
        //   this.eTagCache.set(driveId, response.result.etag);
        //   console.log(`${context}: Successfully synced to Drive`);
        //   return true;
        // }

        console.log(`${context}: Would upload content (length=${content.length}) to driveId ${driveId}`);
        return true;
      } catch (apiError) {
        const err = apiError instanceof Error ? apiError : new Error(String(apiError));
        console.error(`${context}: API error - ${err.message}`);

        // Check if it's a rate limit or auth error
        if ((apiError as any).status === 403) {
          console.error(`${context}: Permission denied. Check Google Drive access.`);
        } else if ((apiError as any).status === 401) {
          console.error(`${context}: Unauthorized. Token may have expired.`);
        } else if ((apiError as any).status === 429) {
          console.warn(`${context}: Rate limited by Google Drive API. Will retry.`);
        }

        throw err;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`${context}: ${err.message}`);
      return false;
    }
  }

  /**
   * Pull remote changes from Google Drive
   */
  async pull(fileId: string, localVersion?: number): Promise<string | null> {
    const context = `${this.name}::pull(${fileId})`;
    try {
      if (!this.driveClient) {
        console.warn(`${context}: Drive client not initialized, skipping pull`);
        return null;
      }

      try {
        // TODO: Implement actual Google Drive API call
        // const response = await this.driveClient.files.get({
        //   fileId: driveId,
        //   alt: 'media',
        //   fields: 'etag, modifiedTime'
        // });
        //
        // const currentETag = this.eTagCache.get(driveId);
        // if (currentETag && response.result.etag === currentETag) {
        //   return null; // No changes
        // }
        //
        // this.eTagCache.set(driveId, response.result.etag);
        // return new Uint8Array(response.body);

        console.log(`${context}: Would download from Google Drive`);
        return null; // No changes for now
      } catch (apiError) {
        const err = apiError instanceof Error ? apiError : new Error(String(apiError));

        if ((apiError as any).status === 404) {
          console.warn(`${context}: File not found on Google Drive`);
          return null;
        } else if ((apiError as any).status === 401) {
          console.error(`${context}: Unauthorized. Token may have expired.`);
        } else if ((apiError as any).status === 403) {
          console.error(`${context}: Permission denied.`);
        }

        console.warn(`${context}: ${err.message}`);
        return null;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`${context}: ${err.message}`);
      return null;
    }
  }

  /**
   * Check if file exists on Google Drive
   */
  async exists(fileId: string): Promise<boolean> {
    const context = `${this.name}::exists(${fileId})`;
    try {
      if (!this.driveClient) {
        return false;
      }

      try {
        // TODO: Implement Google Drive files.get with minimal fields
        // const response = await this.driveClient.files.get({
        //   fileId: driveId,
        //   fields: 'id'
        // });
        //
        // return !!response.result.id;

        return false;
      } catch (apiError) {
        const err = apiError instanceof Error ? apiError : new Error(String(apiError));
        if ((apiError as any).status === 404) {
          return false; // Not found
        }
        console.warn(`${context}: ${err.message}`);
        return false;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`${context}: ${err.message}`);
      return false;
    }
  }

  /**
   * Delete file from Google Drive
   */
  async delete(fileId: string): Promise<boolean> {
    const context = `${this.name}::delete(${fileId})`;
    try {
      if (!this.driveClient) {
        console.error(`${context}: Drive client not initialized`);
        return false;
      }

      try {
        // TODO: Implement Google Drive files.delete
        // await this.driveClient.files.delete({
        //   fileId: driveId
        // });
        //
        // this.eTagCache.delete(driveId);

        console.log(`${context}: Would delete from Google Drive`);
        return true;
      } catch (apiError) {
        const err = apiError instanceof Error ? apiError : new Error(String(apiError));

        if ((apiError as any).status === 404) {
          console.warn(`${context}: File not found, treating as deleted`);
          this.eTagCache.delete(fileId);
          return true;
        } else if ((apiError as any).status === 401) {
          console.error(`${context}: Unauthorized.`);
        } else if ((apiError as any).status === 403) {
          console.error(`${context}: Permission denied.`);
        }

        console.error(`${context}: ${err.message}`);
        return false;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`${context}: ${err.message}`);
      return false;
    }
  }

  /**
   * Watch Google Drive for changes
   * Implements long-polling since Google Drive API doesn't support real-time webhooks well
   */
  watch?(): Observable<string> {
    return new Observable<string>((subscriber) => {
      const context = 'GDriveAdapter::watch()';
      let pollSubscription: any = null;

      try {
        if (!this.driveClient) {
          console.info(`${context}: Drive client not initialized, skipping watch`);
          subscriber.complete();
          return;
        }

        // Start polling every 30 seconds
        const pollInterval = 30000;
        const lastChanges = new Map<string, number>();

        pollSubscription = timer(0, pollInterval).subscribe(async () => {
          try {
            // TODO: Implement Google Drive changes.list API
            // const response = await this.driveClient.changes.list({
            //   pageToken: this.changePageToken,
            //   spaces: 'drive',
            //   fields: 'changes(fileId, removed), nextPageToken'
            // });
            //
            // if (response.result.changes) {
            //   response.result.changes.forEach((change: any) => {
            //     if (!change.removed) {
            //       subscriber.next(change.fileId);
            //     }
            //   });
            // }
            //
            // if (response.result.nextPageToken) {
            //   this.changePageToken = response.result.nextPageToken;
            // }
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error(`${context}: Polling error - ${err.message}`);
            // Don't unsubscribe on error, continue polling
          }
        });

        console.log(`${context}: Polling started (interval: ${pollInterval}ms)`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`${context}: Setup error - ${err.message}`);
        subscriber.error(err);
      }

      // Cleanup function
      return () => {
        if (pollSubscription) {
          pollSubscription.unsubscribe();
        }
        console.log(`${context}: Polling stopped`);
      };
    });
  }

  /**
   * Optional: list files for a Google Drive workspace. Not implemented yet.
   */
  async listWorkspaceFiles(workspaceId?: string, path?: string): Promise<{ id: string; path: string; metadata?: any }[]> {
    if (!this.driveClient || !this.driveClient.files || typeof this.driveClient.files.list !== 'function') {
      console.info('GDriveAdapter.listWorkspaceFiles: drive client not available');
      return [];
    }

    try {
      const parent = path || workspaceId || 'root';
      const results: Array<{ id: string; path: string; metadata?: any }> = [];
      let pageToken: string | undefined = undefined;
      do {
        const res = await this.driveClient.files.list({
          q: `'${parent}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, modifiedTime) ',
          pageToken,
        });
        const files = (res && (res.data || res.result || res))?.files || [];
        for (const f of files) {
          results.push({ id: f.id, path: f.name, metadata: f });
        }
        pageToken = (res && (res.data || res.result || res))?.nextPageToken;
      } while (pageToken);

      return results;
    } catch (err) {
      console.warn('GDriveAdapter.listWorkspaceFiles failed:', err);
      return [];
    }
  }

  /**
   * Optional: pull multiple files for a workspace. Not implemented yet.
   */
  async pullWorkspace(workspaceId?: string, path?: string): Promise<Array<{ fileId: string; content: string }>> {
    if (!this.driveClient || !this.driveClient.files) {
      console.info('GDriveAdapter.pullWorkspace: drive client not available');
      return [];
    }

    try {
      const files = await this.listWorkspaceFiles(workspaceId, path);
      const items: Array<{ fileId: string; content: string }> = [];
      for (const f of files) {
        try {
          // Attempt to download file media
          const res = await this.driveClient.files.get({ fileId: f.id, alt: 'media' }, { responseType: 'arraybuffer' });
          const data = (res && (res.data || res.result || res)) || null;
          if (data) {
            const buf = data instanceof ArrayBuffer ? Buffer.from(data) : Buffer.from(data);
            items.push({ fileId: f.id, content: buf.toString('utf-8') });
          }
        } catch (err) {
          console.warn('GDriveAdapter.pullWorkspace: failed to download', f.id, err);
        }
      }
      return items;
    } catch (err) {
      console.warn('GDriveAdapter.pullWorkspace failed:', err);
      return [];
    }
  }
}

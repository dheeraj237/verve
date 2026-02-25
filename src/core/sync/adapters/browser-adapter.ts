/**
 * DEPRECATED: BrowserAdapter is no longer used
 * 
 * Browser workspaces are PURELY LOCAL and require NO sync adapter.
 * All changes are persisted in IndexedDB and stay on the user's browser.
 * 
 * Workspace Types:
 * - 'browser': Local IndexedDB only, no sync needed (no adapter)
 * - 'local': Desktop/electron filesystem sync via LocalAdapter
 * - 'gdrive': Google Drive sync via GDriveAdapter
 * - 's3': S3-compatible storage sync via S3Adapter (future)
 * 
 * If you need a backend storage option, use S3Adapter instead.
 * See: src/core/sync/adapters/s3-adapter.ts
 */

export class BrowserAdapter {
  constructor() {
    throw new Error(
      'BrowserAdapter is deprecated. Browser workspaces require no adapter (purely local IndexedDB). ' +
      'Use LocalAdapter for desktop sync, GDriveAdapter for Google Drive, or S3Adapter for cloud storage.'
    );
  }
}


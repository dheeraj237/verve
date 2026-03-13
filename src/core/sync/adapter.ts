/**
 * IAdapter — the single adapter interface + filter contract for the simplified
 * Adapter + SyncManager architecture (v2).
 *
 * All adapters (LocalAdapter, BrowserAdapter) implement this interface.
 * No legacy ISyncAdapter, AdapterLifecycle, or registry concepts here.
 */

export interface FileFilter {
  ignoreNames: string[];
  ignoreExtensions: string[];
  ignoreFolders: string[];
  maxFileSizeMB: number;
}

export interface IAdapter {
  readonly workspaceId: string;
  readonly type: 'local' | 'browser';

  /**
   * Pull all files from the source (filesystem / no-op) into RxDB.
   * Must always write with dirty:false, isSynced:true.
   * Accepts an AbortSignal to short-circuit stale pulls on workspace switch.
   */
  pull(signal?: AbortSignal): Promise<void>;

  /**
   * Push a single file's content back to the source.
   * @param path - workspace-relative path of the file (e.g. "notes/foo.md")
   * @param content - UTF-8 text content to write
   */
  push(path: string, content: string): Promise<void>;

  /**
   * Ensure the adapter has the permissions it needs to operate.
   * MUST be called from a user-gesture handler (button click) if it may
   * show a native file-system dialog.
   * Returns true if permission was granted, false otherwise.
   */
  ensurePermission(): Promise<boolean>;

  /** Filter contract — adapters define their own include/exclude rules. */
  shouldIncludeFile(path: string, name: string, sizeBytes: number): boolean;
  shouldIncludeFolder(name: string): boolean;

  /**
   * Release all resources. After destroy(), no further pull/push calls will
   * write to RxDB — the _destroyed flag short-circuits any in-flight work.
   */
  destroy(): void;
}

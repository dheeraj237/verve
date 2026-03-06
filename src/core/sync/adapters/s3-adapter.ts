import { Observable } from 'rxjs';
import type { ISyncAdapter, AdapterFileDescriptor, AdapterInitContext } from '../adapter-types';
import {
  AdapterState,
  AdapterInitError,
  AdapterErrorCode,
  AdapterReadinessInfo,
  AdapterLifecycleEvent,
  AdapterEventListener,
} from '../types/adapter-lifecycle';
import type { FileNode } from '@/shared/types';

/**
 * S3 storage adapter (future implementation)
 * 
 * Syncs files with Amazon S3 or S3-compatible storage backends
 * Can be used for workspaces stored on S3, MinIO, DigitalOcean Spaces, etc.
 */
export class S3Adapter implements ISyncAdapter {
  readonly name = 's3';
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private error: AdapterInitError | null = null;
  private listeners: Set<AdapterEventListener> = new Set();

  constructor(
    private workspaceId: string,
    private bucket: string,
    private region: string,
    private credentials?: any // AWS credentials or pre-signed URLs
  ) {}

  // ============================================================================
  // LIFECYCLE INTERFACE
  // ============================================================================

  getState(): AdapterState {
    return this.state;
  }

  getError(): AdapterInitError | null {
    return this.error;
  }

  getReadinessInfo(): AdapterReadinessInfo {
    const isReady =
      this.state === AdapterState.READY &&
      !!this.bucket &&
      !!this.region;
    return new AdapterReadinessInfo(
      isReady,
      this.state,
      this.error,
      this.workspaceId,
      isReady,
      new Date()
    );
  }

  validateReady(): boolean {
    return this.state === AdapterState.READY && !!this.bucket && !!this.region;
  }

  async initialize(context: AdapterInitContext): Promise<void> {
    try {
      this.setState(AdapterState.INITIALIZING);

      if (context.workspaceId !== this.workspaceId) {
        throw new AdapterInitError(
          AdapterErrorCode.WORKSPACE_NOT_FOUND,
          `Workspace mismatch`
        );
      }

      // TODO: Validate S3 credentials and bucket access
      // For now, just mark as ready if we have bucket and region
      if (!this.bucket || !this.region) {
        throw new AdapterInitError(
          AdapterErrorCode.CREDENTIALS_INVALID,
          `S3 bucket and region required`
        );
      }

      this.setState(AdapterState.READY);
      this.emitEvent({
        type: 'ready',
        workspaceId: this.workspaceId,
        timestamp: new Date(),
      });
    } catch (err) {
      const error = new AdapterInitError(
        AdapterErrorCode.INITIALIZATION_FAILED,
        `Failed to initialize S3 adapter`,
        err as Error
      );
      this.setState(AdapterState.ERRORED, error);
      this.emitEvent({
        type: 'initialization-failed',
        error,
        timestamp: new Date(),
      });
    }
  }

  async destroy(): Promise<void> {
    this.setState(AdapterState.DESTROYING);
    this.listeners.clear();
    this.setState(AdapterState.DESTROYED);
  }

  addEventListener(listener: AdapterEventListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: AdapterEventListener): void {
    this.listeners.delete(listener);
  }

  // ============================================================================
  // ADAPTER OPERATIONS (STUBBED)
  // ============================================================================

  async push(file: AdapterFileDescriptor | FileNode, content: string): Promise<boolean> {
    try {
      // TODO: Implement S3 PutObject
      // Use AWS SDK or presigned URL to upload file content as UTF-8 text or binary
      const fileId = 'id' in file ? file.id : (file as FileNode).id;
      console.log(`S3Adapter push: ${fileId} (content length=${content.length})`);
      return true;
    } catch (error) {
      console.error('S3Adapter push error:', error);
      return false;
    }
  }

  async pull(fileId: string, localVersion?: number): Promise<string | null> {
    try {
      // TODO: Implement S3 GetObject
      // Check ETag or LastModified to see if remote has changes
      // Retrieve file contents as Uint8Array
      console.log(`S3Adapter pull: ${fileId}`);
      return null; // Return null if no changes or not found
    } catch (error) {
      console.error('S3Adapter pull error:', error);
      return null;
    }
  }

  async exists(fileId: string): Promise<boolean> {
    try {
      // TODO: Implement S3 HeadObject
      return false;
    } catch (error) {
      console.error('S3Adapter exists error:', error);
      return false;
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      // TODO: Implement S3 DeleteObject
      return true;
    } catch (error) {
      console.error('S3Adapter delete error:', error);
      return false;
    }
  }

  watch?(): Observable<string> {
    // TODO: Implement S3 event notifications via SQS or SNS
    // Or implement polling for changes via S3 list versions
    return new Observable((subscriber) => {
      // Watch for changes and emit fileIds
    });
  }

  /**
   * Optional: list files for an S3 workspace. Not implemented yet.
   */
  async listWorkspaceFiles(workspaceId?: string, path?: string): Promise<{ id: string; path: string; metadata?: any }[]> {
    console.info('S3Adapter.listWorkspaceFiles: stub (not implemented)');
    return [];
  }

  /**
   * Optional: pull multiple files for a workspace. Not implemented yet.
   */
  async pullWorkspace(workspaceId?: string, path?: string): Promise<Array<{ id: string; path: string; metadata?: Record<string, any> }>> {
    console.info('S3Adapter.pullWorkspace: stub (not implemented)');
    return [];
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private setState(newState: AdapterState, error: AdapterInitError | null = null): void {
    const prevState = this.state;
    this.state = newState;
    this.error = error;
    console.log(
      `[S3Adapter] State transition: ${prevState} → ${newState}${error ? ` (error: ${error.code})` : ''}`
    );
    this.emitEvent({
      type: 'state-changed',
      state: newState,
      previousState: prevState,
      timestamp: new Date(),
    });
  }

  private emitEvent(event: AdapterLifecycleEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[S3Adapter] Event listener error:', err);
      }
    }
  }
}

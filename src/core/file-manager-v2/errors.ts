/**
 * Error types and classes for File Manager V2
 */

export enum FileErrorType {
  NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONFLICT = 'FILE_CONFLICT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ADAPTER_ERROR = 'ADAPTER_ERROR',
  INVALID_PATH = 'INVALID_PATH',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Custom error class for file system operations
 */
export class FileSystemError extends Error {
  constructor(
    public type: FileErrorType,
    public path: string,
    message: string,
    public retryable: boolean = false,
    public metadata?: any
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

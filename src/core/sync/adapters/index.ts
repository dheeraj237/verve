/**
 * Sync adapters for different workspace storage backends
 * 
 * Browser workspace: No adapter needed (local-only, no sync)
 * Local workspace: LocalAdapter (filesystem)
 * GDrive workspace: GDriveAdapter (Google Drive)
 * S3 workspace (future): S3Adapter (S3 bucket)
 */

export * from './local-adapter';
export * from './gdrive-adapter';
export * from './s3-adapter';

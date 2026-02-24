/**
 * Google Drive Adapter V2 - Uses Google Drive API v3
 */

import { WorkspaceAdapter, WorkspaceType, FileData, FileMetadata, AdapterCapabilities } from '../types';
import { FileSystemError, FileErrorType } from '../errors';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * Google Drive adapter using Drive API v3
 */
export class GoogleDriveAdapterV2 implements WorkspaceAdapter {
  type = WorkspaceType.GOOGLE_DRIVE;
  capabilities: AdapterCapabilities = {
    supportsWatch: false,
    supportsBatch: false,
    supportsVersioning: true,
    supportsRename: true,
    supportsDirectories: true,
    maxFileSize: 5 * 1024 * 1024, // 5MB for now
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerMinute: 100,
    },
  };

  private folderId: string | null = null;
  private getAccessToken: () => Promise<string | null>;

  constructor(getAccessToken: () => Promise<string | null>, folderId?: string) {
    this.getAccessToken = getAccessToken;
    this.folderId = folderId || null;
  }

  /**
   * Set the root folder ID
   */
  setFolderId(folderId: string): void {
    this.folderId = folderId;
  }

  /**
   * Read a file from Google Drive
   */
  async readFile(path: string): Promise<FileData> {
    const token = await this.ensureAuthenticated();

    try {
      // Fetch metadata
      const metaRes = await fetch(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(path)}?fields=id,name,mimeType,modifiedTime,size`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!metaRes.ok) {
        throw new FileSystemError(
          FileErrorType.NOT_FOUND,
          path,
          'Failed to read file metadata'
        );
      }

      const meta = await metaRes.json();

      // Fetch content
      const contentRes = await fetch(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(path)}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!contentRes.ok) {
        throw new FileSystemError(
          FileErrorType.NOT_FOUND,
          path,
          'Failed to read file content'
        );
      }

      const content = await contentRes.text();

      return {
        id: meta.id,
        path: meta.id,
        name: meta.name,
        category: this.getCategoryFromPath(meta.name),
        content,
        size: Number(meta.size || 0),
        lastModified: meta.modifiedTime ? new Date(meta.modifiedTime) : undefined,
        version: meta.modifiedTime,
        mimeType: meta.mimeType,
      };
    } catch (error: any) {
      if (error instanceof FileSystemError) throw error;
      
      throw new FileSystemError(
        FileErrorType.NETWORK_ERROR,
        path,
        `Drive API error: ${error.message}`,
        true
      );
    }
  }

  /**
   * Write a file to Google Drive
   * Returns the file ID if a new file was created
   */
  async writeFile(path: string, content: string, version?: string): Promise<string | void> {
    const token = await this.ensureAuthenticated();

    try {
      // Check version conflict if provided
      if (version) {
        const currentVersion = await this.getFileVersion(path);
        if (currentVersion && currentVersion !== version) {
          throw new FileSystemError(
            FileErrorType.CONFLICT,
            path,
            'Version conflict detected'
          );
        }
      }

      // Check if file exists (path should be a Drive file ID)
      const exists = await this.fileExists(path);

      if (exists) {
        // Update existing file
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(path)}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'text/markdown',
            },
            body: content,
          }
        );
        return; // No new ID, file already existed
      } else {
        // Create new file - path is filename when file doesn't exist
        const folderId = this.folderId || await this.getStoredFolderId();
        if (!folderId) {
          throw new FileSystemError(
            FileErrorType.ADAPTER_ERROR,
            path,
            'No folder ID configured'
          );
        }

        const metadata = {
          name: this.getFileName(path),
          parents: [folderId],
          mimeType: 'text/markdown',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'text/markdown' }));

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          }
        );

        if (!response.ok) {
          throw new Error('Failed to create file');
        }

        const data = await response.json();
        return data.id; // Return the new Drive file ID
      }
    } catch (error: any) {
      if (error instanceof FileSystemError) throw error;
      
      throw new FileSystemError(
        FileErrorType.NETWORK_ERROR,
        path,
        `Drive API error: ${error.message}`,
        true
      );
    }
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(path: string): Promise<void> {
    const token = await this.ensureAuthenticated();

    try {
      const res = await fetch(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(path)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        throw new FileSystemError(
          FileErrorType.NOT_FOUND,
          path,
          'Failed to delete file'
        );
      }
    } catch (error: any) {
      if (error instanceof FileSystemError) throw error;
      
      throw new FileSystemError(
        FileErrorType.NETWORK_ERROR,
        path,
        `Drive API error: ${error.message}`,
        true
      );
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(directory = ''): Promise<FileMetadata[]> {
    const token = await this.ensureAuthenticated();
    const folderId = directory || this.folderId || await this.getStoredFolderId();

    if (!folderId) {
      throw new FileSystemError(
        FileErrorType.ADAPTER_ERROR,
        directory,
        'No folder ID configured'
      );
    }

    try {
      const query = `'${folderId}' in parents and trashed=false`;
      const res = await fetch(
        `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        throw new FileSystemError(
          FileErrorType.NETWORK_ERROR,
          directory,
          'Failed to list files'
        );
      }

      const data = await res.json();
      
      return (data.files || []).map((file: any) => ({
        id: file.id,
        path: file.id,
        name: file.name,
        category: this.getCategoryFromPath(file.name),
        size: Number(file.size || 0),
        lastModified: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
        mimeType: file.mimeType,
      }));
    } catch (error: any) {
      if (error instanceof FileSystemError) throw error;
      
      throw new FileSystemError(
        FileErrorType.NETWORK_ERROR,
        directory,
        `Drive API error: ${error.message}`,
        true
      );
    }
  }

  /**
   * Rename a file
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const token = await this.ensureAuthenticated();

    try {
      const newName = this.getFileName(newPath);
      
      await fetch(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(oldPath)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newName }),
        }
      );
    } catch (error: any) {
      throw new FileSystemError(
        FileErrorType.NETWORK_ERROR,
        oldPath,
        `Drive API error: ${error.message}`,
        true
      );
    }
  }

  /**
   * Create a folder
   */
  async createFolder(path: string): Promise<void> {
    const token = await this.ensureAuthenticated();
    const folderId = this.folderId || await this.getStoredFolderId();

    if (!folderId) {
      throw new FileSystemError(
        FileErrorType.ADAPTER_ERROR,
        path,
        'No folder ID configured'
      );
    }

    try {
      const metadata = {
        name: this.getFileName(path),
        parents: [folderId],
        mimeType: 'application/vnd.google-apps.folder',
      };

      await fetch(
        `${DRIVE_API_BASE}/files`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        }
      );
    } catch (error: any) {
      throw new FileSystemError(
        FileErrorType.NETWORK_ERROR,
        path,
        `Drive API error: ${error.message}`,
        true
      );
    }
  }

  /**
   * Get file version (modifiedTime)
   */
  async getFileVersion(path: string): Promise<string | undefined> {
    try {
      const token = await this.ensureAuthenticated();
      
      const res = await fetch(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(path)}?fields=modifiedTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) return undefined;
      
      const data = await res.json();
      return data.modifiedTime;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      const token = await this.ensureAuthenticated();
      
      const res = await fetch(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(path)}?fields=id`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ensure user is authenticated
   */
  private async ensureAuthenticated(): Promise<string> {
    const token = await this.getAccessToken();
    
    if (!token) {
      throw new FileSystemError(
        FileErrorType.PERMISSION_DENIED,
        '',
        'Not authenticated with Google Drive'
      );
    }

    return token;
  }

  /**
   * Get stored folder ID from localStorage
   */
  private async getStoredFolderId(): Promise<string | null> {
    return localStorage.getItem('verve_gdrive_folder_id');
  }

  /**
   * Extract filename from path
   */
  private getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  /**
   * Get category from path
   */
  private getCategoryFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : 'root';
  }
}

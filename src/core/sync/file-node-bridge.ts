/**
 * FileNodeBridge - Converts between adapter-specific formats and unified FileNode type
 *
 * Purpose:
 * - Central orchestration of FileNode ↔ Adapter format conversions
 * - Decouples adapters from FileNode type
 * - Enables adapter-specific converters to be plugged in
 *
 * Data flow:
 * Adapter (GDrive, Local FS, S3) → AdapterEntry → FileNodeBridge → FileNode
 * FileNode → FileNodeBridge → AdapterFileDescriptor → Adapter.push()
 */

import type { FileNode } from '@/shared/types';
import { FileType, WorkspaceType } from '@/shared/types';
import type { AdapterFileDescriptor } from './adapter-types';

export type AdapterEntry = {
  id?: string;
  path: string;
  metadata?: Record<string, any>;
  modifiedTime?: number;
};

export type AdapterType = 'gdrive' | 'local' | 'browser' | 's3' | 'drive';

/**
 * Converts remote adapter response entries into FileNode format (without content)
 * Serves as the central conversion point for all adapter types
 */
export class FileNodeBridge {
  /**
   * Convert an array of adapter entries to FileNode[] (lazy-load content)
   * @param entries Adapter-specific entries
   * @param adapterType Type of adapter (gdrive, local, s3, etc)
   * @param workspaceId Workspace ID
   * @returns Array of FileNodes without content
   */
  adapterResponseToFileNode(
    entries: AdapterEntry[],
    adapterType: AdapterType,
    workspaceId: string
  ): FileNode[] {
    return entries.map(entry =>
      this.convertAdapterEntry(entry, adapterType, workspaceId)
    );
  }

  /**
   * Convert a single adapter entry to FileNode
   * @param entry Single adapter entry
   * @param adapterType Type of adapter
   * @param workspaceId Workspace ID
   * @returns FileNode (no content)
   */
  convertAdapterEntry(
    entry: AdapterEntry,
    adapterType: AdapterType,
    workspaceId: string
  ): FileNode {
    const converter = this.getConverter(adapterType);
    return converter.fromAdapterEntry(entry, workspaceId);
  }

  /**
   * Convert FileNode array to adapter push descriptors
   * @param files FileNodes to push (with content for files)
   * @param adapterType Target adapter type
   * @returns Array of AdapterFileDescriptors ready for push
   */
  fileNodeToAdapterDescriptor(
    files: FileNode[],
    adapterType: AdapterType
  ): AdapterFileDescriptor[] {
    const converter = this.getConverter(adapterType);
    return files.map(file => converter.toAdapterDescriptor(file));
  }

  /**
   * Get adapter-specific converter
   * @param adapterType Type of adapter
   * @returns Converter instance for that adapter type
   */
  private getConverter(adapterType: AdapterType): AdapterConverter {
    switch (adapterType) {
      case 'gdrive':
        return new GDriveConverter();
      case 'local':
      case 'browser':
        return new LocalConverter();
      case 's3':
      case 'drive':
        return new S3Converter();
      default:
        return new DefaultConverter();
    }
  }
}

/**
 * Interface for adapter-specific converters
 */
interface AdapterConverter {
  /**
   * Convert adapter entry to FileNode
   */
  fromAdapterEntry(entry: AdapterEntry, workspaceId: string): FileNode;

  /**
   * Convert FileNode to adapter descriptor
   */
  toAdapterDescriptor(file: FileNode): AdapterFileDescriptor;
}

/**
 * Default converter for adapter entries
 * Works with generic AdapterEntry format
 */
class DefaultConverter implements AdapterConverter {
  fromAdapterEntry(entry: AdapterEntry, workspaceId: string): FileNode {
    const id = entry.id ?? entry.path ?? '';
    const path = String(entry.path ?? '');
    const name = path.split('/').filter(Boolean).pop() || path || 'untitled';

    // Detect if directory from metadata
    const metadata = entry.metadata ?? {};
    const mime = (metadata.mimeType || metadata['mime_type'] || '').toString().toLowerCase();
    const isDirectory =
      mime.includes('folder') ||
      mime.includes('directory') ||
      path.endsWith('/');

    // Extract content from metadata if available (for adapters that include it)
    const content: string | undefined = metadata.content && typeof metadata.content === 'string'
      ? metadata.content
      : undefined;

    return {
      id: String(id),
      path: String(path),
      name,
      type: isDirectory ? FileType.Directory : FileType.File,
      workspaceId,
      workspaceType: WorkspaceType.Browser,
      dirty: false,
      isSynced: false,
      syncStatus: 'idle',
      version: 0,
      size: metadata.size ? Number(metadata.size) : undefined,
      mimeType: metadata.mimeType ?? metadata.mime_type ?? undefined,
      createdAt: metadata.createdTime ?? metadata.createdAt ?? undefined,
      modifiedAt: metadata.modifiedTime ?? metadata.modifiedAt ?? undefined,
      content,
    };
  }

  toAdapterDescriptor(file: FileNode): AdapterFileDescriptor {
    return {
      id: file.id,
      path: file.path,
      metadata: {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedAt ? new Date(file.modifiedAt).getTime() : undefined,
      },
    };
  }
}

/**
 * Google Drive-specific converter
 */
class GDriveConverter implements AdapterConverter {
  fromAdapterEntry(entry: AdapterEntry, workspaceId: string): FileNode {
    const converter = new DefaultConverter();
    const fileNode = converter.fromAdapterEntry(entry, workspaceId);
    return {
      ...fileNode,
      workspaceType: WorkspaceType.GDrive,
    };
  }

  toAdapterDescriptor(file: FileNode): AdapterFileDescriptor {
    return {
      id: file.id,
      path: file.path,
      metadata: {
        name: file.name,
        mimeType:
          file.type === FileType.Directory
            ? 'application/vnd.google-apps.folder'
            : file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedAt
          ? new Date(file.modifiedAt).getTime()
          : undefined,
      },
    };
  }
}

/**
 * Local File System and Browser-specific converter
 */
class LocalConverter implements AdapterConverter {
  fromAdapterEntry(entry: AdapterEntry, workspaceId: string): FileNode {
    const converter = new DefaultConverter();
    const fileNode = converter.fromAdapterEntry(entry, workspaceId);
    return {
      ...fileNode,
      workspaceType: WorkspaceType.Local,
    };
  }

  toAdapterDescriptor(file: FileNode): AdapterFileDescriptor {
    return {
      id: file.id,
      path: file.path,
      metadata: {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedAt
          ? new Date(file.modifiedAt).getTime()
          : undefined,
      },
    };
  }
}

/**
 * AWS S3-specific converter
 */
class S3Converter implements AdapterConverter {
  fromAdapterEntry(entry: AdapterEntry, workspaceId: string): FileNode {
    const converter = new DefaultConverter();
    const fileNode = converter.fromAdapterEntry(entry, workspaceId);
    return {
      ...fileNode,
      workspaceType: WorkspaceType.S3,
    };
  }

  toAdapterDescriptor(file: FileNode): AdapterFileDescriptor {
    return {
      id: file.id,
      path: file.path,
      metadata: {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedAt
          ? new Date(file.modifiedAt).getTime()
          : undefined,
      },
    };
  }
}

/**
 * Export singleton bridge instance
 */
export const fileNodeBridge = new FileNodeBridge();

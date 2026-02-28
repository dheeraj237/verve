import type { CachedFile, WorkspaceType, FileType } from '@/core/cache/types';
import { FileType as _FileType } from '@/core/cache/types';

/**
 * Normalize a remote adapter listing entry into the local CachedFile shape
 * Attempts to preserve metadata and set canonical fields used by the cache.
 */
export function adapterEntryToCachedFile(
  entry: { id?: string; path?: string; metadata?: Record<string, any> } | { fileId?: string },
  workspaceType: WorkspaceType | string,
  workspaceId?: string
): CachedFile {
  const id = (entry as any).id ?? (entry as any).fileId ?? '';
  const path = (entry as any).path ?? id;
  const metadata = (entry as any).metadata ?? {};

  // Detect directory vs file using common metadata cues
  const mime = (metadata && (metadata.mimeType || metadata['mime_type'])) || '';
  const isDirectory = String(mime).toLowerCase().includes('folder') || String(mime).toLowerCase().includes('directory') || false;

  const name = metadata?.name ?? String(path).split('/').filter(Boolean).pop() ?? id;

  const out: CachedFile = {
    id: String(id),
    name: String(name),
    path: String(path),
    type: isDirectory ? _FileType.Dir : _FileType.File,
    workspaceType: workspaceType as any,
    workspaceId: workspaceId ?? null,
    content: undefined,
    meta: metadata && Object.keys(metadata).length ? metadata : undefined,
    size: metadata?.size !== undefined ? Number(metadata.size) : undefined,
    modifiedAt: metadata?.modifiedTime ?? metadata?.modifiedAt ?? undefined,
    createdAt: metadata?.createdTime ?? metadata?.createdAt ?? undefined,
    dirty: false,
    isSynced: true,
  } as CachedFile;

  if (isDirectory) {
    out.children = Array.isArray((entry as any).children) ? (entry as any).children.map(String) : [];
  }

  return out;
}

export default adapterEntryToCachedFile;

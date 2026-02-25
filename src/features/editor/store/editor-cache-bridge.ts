import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import {
  initializeRxDB,
  getCacheDB,
  getCachedFile,
  upsertCachedFile,
  observeCachedFiles,
  observeYjsText,
  createOrLoadYjsDoc,
  getYjsText,
  setYjsText
} from '../../../core/cache';
import type { CachedFile } from '../../../core/cache/types';

export interface EditorCacheContextType {
  initialized: boolean;
  currentFileId: string | null;
  ydoc: Y.Doc | null;
  fileMetadata: CachedFile | null;
  isDirty: boolean;
  error: Error | null;
}

/**
 * Hook to initialize RxDB and manage the editor cache lifecycle
 */
export function useEditorCache() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeRxDB();
        setInitialized(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('Failed to initialize editor cache:', error);
      }
    };

    init();
  }, []);

  return { initialized, error };
}

/**
 * Hook to open a file for editing with Yjs CRDT document
 * Returns the Y.Doc instance and file metadata
 */
export function useOpenFileForEditing(fileId: string | null, filePath?: string) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [fileMetadata, setFileMetadata] = useState<CachedFile | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileId) {
      setYdoc(null);
      setFileMetadata(null);
      return;
    }

    const loadFile = async () => {
      try {
        // Load or create cached file entry
        let cachedFile = await getCachedFile(fileId);
        if (!cachedFile) {
          // Create new cached file if doesn't exist
          cachedFile = {
            id: fileId,
            name: filePath?.split('/').pop() || 'Untitled',
            path: filePath || fileId,
            type: 'file',
            dirty: false
          };
          await upsertCachedFile(cachedFile);
        }

        // Create or load Yjs document with unique CRDT ID
        const crdtId = cachedFile.crdtId || `crdt_${fileId}`;
        const doc = await createOrLoadYjsDoc({
          crdtId,
          fileId,
          initialContent: ''
        });

        // Update cached file with CRDT link if new
        if (!cachedFile.crdtId) {
          await upsertCachedFile({ ...cachedFile, crdtId });
        }

        setYdoc(doc);
        setFileMetadata(cachedFile);
        setIsDirty(Boolean(cachedFile.dirty));
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('Failed to open file for editing:', fileId, error);
      }
    };

    loadFile();
  }, [fileId, filePath]);

  return { ydoc, fileMetadata, isDirty, error };
}

/**
 * Hook to sync editor content with Yjs document and mark as dirty
 */
export function useEditorSync(fileId: string | null, ydoc: Y.Doc | null) {
  const [content, setContent] = useState('');
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!ydoc || !fileId) return;

    // Get initial content from Yjs doc
    setContent(getYjsText(ydoc));

    // Subscribe to Yjs changes
    const unsub = observeYjsText(ydoc, (newContent) => {
      setContent(newContent);
      // Mark file as dirty in RxDB
      markFileAsDirty(fileId);
    });

    setUnsubscribe(() => unsub);

    return () => {
      unsub();
    };
  }, [ydoc, fileId]);

  /**
   * Update editor content and sync to Yjs
   */
  const updateContent = useCallback(
    (newContent: string) => {
      if (ydoc) {
        setYjsText(ydoc, newContent);
        setContent(newContent);
      }
    },
    [ydoc]
  );

  return { content, updateContent };
}

/**
 * Mark a file as dirty (has unsaved changes) in RxDB
 */
async function markFileAsDirty(fileId: string): Promise<void> {
  try {
    const fileMetadata = await getCachedFile(fileId);
    if (fileMetadata && !fileMetadata.dirty) {
      await upsertCachedFile({ ...fileMetadata, dirty: true });
    }
  } catch (error) {
    console.error('Failed to mark file as dirty:', fileId, error);
  }
}

/**
 * Hook to monitor all cached files for UI updates (e.g., file tree)
 */
export function useCachedFilesList(pathPrefix?: string) {
  const [files, setFiles] = useState<CachedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const subscription = observeCachedFiles((cachedFiles) => {
      // Filter by path prefix if provided
      const filtered = pathPrefix
        ? cachedFiles.filter((f) => f.path.startsWith(pathPrefix))
        : cachedFiles;
      setFiles(filtered);
      setLoading(false);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [pathPrefix]);

  return { files, loading, error };
}

/**
 * Hook to get uncommitted changes (dirty files) in cache
 */
export function useDirtyFiles() {
  const [dirtyFiles, setDirtyFiles] = useState<CachedFile[]>([]);

  useEffect(() => {
    const subscription = observeCachedFiles((cachedFiles) => {
      const dirty = cachedFiles.filter((f) => f.dirty);
      setDirtyFiles(dirty);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  return dirtyFiles;
}

/**
 * Helper to close/unload a file from cache (useful for cleanup)
 */
export async function closeEditorFile(fileId: string): Promise<void> {
  try {
    // Optionally unload Yjs doc here if needed
    // For now, just mark it as synced or keep in memory cache
  } catch (error) {
    console.error('Failed to close editor file:', fileId, error);
  }
}

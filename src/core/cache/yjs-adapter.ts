import * as Y from 'yjs';
import {
  getCacheDB,
  getCrdtDoc,
  getCrdtDocByFileId,
  upsertCrdtDoc,
  removeCrdtDoc
} from './rxdb';
import type { CrdtDoc } from './types';

/**
 * In-memory registry of Y.Doc instances keyed by crdtId
 * Prevents loading the same document multiple times
 */
const yjsDocRegistry = new Map<string, Y.Doc>();

/**
 * Subscribe to Yjs updates for a specific document
 * and persist them to RxDB crdt_docs collection
 */
function observeYjsUpdates(crdtId: string, ydoc: Y.Doc): () => void {
  const observer = (update: Uint8Array, origin: any) => {
    // Persist the entire state to RxDB after each update
    persistYjsState(crdtId, ydoc);
  };

  ydoc.on('update', observer);

  // Return cleanup function
  return () => {
    ydoc.off('update', observer);
  };
}

/**
 * Persist the current Yjs document state to RxDB
 */
async function persistYjsState(crdtId: string, ydoc: Y.Doc): Promise<void> {
  try {
    const state = Y.encodeStateAsUpdate(ydoc);
    const stateBase64 = Buffer.from(state).toString('base64');

    await upsertCrdtDoc({
      id: crdtId,
      fileId: crdtId, // This will be updated when we link to actual files
      yjsState: stateBase64,
      lastUpdated: Date.now()
    });
  } catch (error) {
    console.error('Failed to persist Yjs state for crdtId:', crdtId, error);
  }
}

/**
 * Load Yjs state from RxDB and apply it to a document
 */
async function loadYjsState(crdtId: string, ydoc: Y.Doc): Promise<void> {
  try {
    const crdtDoc = await getCrdtDoc(crdtId);

    if (crdtDoc && crdtDoc.yjsState) {
      let state: Uint8Array;
      if (typeof crdtDoc.yjsState === 'string') {
        state = new Uint8Array(Buffer.from(crdtDoc.yjsState, 'base64'));
      } else {
        state = crdtDoc.yjsState;
      }
      Y.applyUpdate(ydoc, state);
    }
  } catch (error) {
    console.error('Failed to load Yjs state for crdtId:', crdtId, error);
  }
}

/**
 * Options for creating/loading a Yjs document
 */
export interface YjsDocOptions {
  crdtId: string;
  fileId?: string;
  initialContent?: string;
}

/**
 * Create or load a Yjs document for collaborative editing.
 * If a CRDT doc exists in RxDB, its state is restored.
 * Otherwise, a new Y.Doc is created with optional initial content.
 *
 * @param options Configuration with crdtId and optional initial content
 * @returns A Y.Doc instance ready for binding to the editor
 */
export async function createOrLoadYjsDoc(
  options: YjsDocOptions
): Promise<Y.Doc> {
  const { crdtId, fileId, initialContent } = options;

  // Check registry first to avoid duplicates
  if (yjsDocRegistry.has(crdtId)) {
    return yjsDocRegistry.get(crdtId)!;
  }

  // Create a new Y.Doc
  const ydoc = new Y.Doc();

  try {
    // Load existing state from RxDB
    await loadYjsState(crdtId, ydoc);

    // If no state exists and we have initial content, initialize with it
    if (!ydoc.getText('content').toString() && initialContent) {
      const ytext = ydoc.getText('content');
      ytext.insert(0, initialContent);
    }

    // If no state was loaded, persist the (possibly initialized) state
    if (!(await getCrdtDoc(crdtId))) {
      await upsertCrdtDoc({
        id: crdtId,
        fileId: fileId || crdtId,
        yjsState: Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64'),
        lastUpdated: Date.now()
      });
    }

    // Set up listener to persist updates to RxDB
    observeYjsUpdates(crdtId, ydoc);

    // Store in registry for future use
    yjsDocRegistry.set(crdtId, ydoc);

    return ydoc;
  } catch (error) {
    console.error('Failed to create or load Yjs doc:', crdtId, error);
    throw error;
  }
}

/**
 * Get an already-loaded Y.Doc from the registry
 * Returns null if not loaded
 */
export function getYjsDoc(crdtId: string): Y.Doc | null {
  return yjsDocRegistry.get(crdtId) || null;
}

/**
 * Unload a Y.Doc from memory and optionally clean up from RxDB
 */
export async function unloadYjsDoc(crdtId: string, deleteFromDb = false): Promise<void> {
  try {
    const ydoc = yjsDocRegistry.get(crdtId);
    if (ydoc) {
      ydoc.destroy();
      yjsDocRegistry.delete(crdtId);
    }

    if (deleteFromDb) {
      await removeCrdtDoc(crdtId);
    }
  } catch (error) {
    console.error('Failed to unload Yjs doc:', crdtId, error);
    throw error;
  }
}

/**
 * Get the text content of a Y.Doc
 */
export function getYjsText(ydoc: Y.Doc, key = 'content'): string {
  try {
    const ytext = ydoc.getText(key);
    return ytext.toString();
  } catch (error) {
    console.error('Failed to get Yjs text:', error);
    return '';
  }
}

/**
 * Set the text content of a Y.Doc (replaces all content)
 */
export function setYjsText(ydoc: Y.Doc, content: string, key = 'content'): void {
  try {
    const ytext = ydoc.getText(key);
    ytext.delete(0, ytext.length);
    ytext.insert(0, content);
  } catch (error) {
    console.error('Failed to set Yjs text:', error);
  }
}

/**
 * Subscribe to text changes in a Y.Doc
 * Returns unsubscribe function
 */
export function observeYjsText(
  ydoc: Y.Doc,
  callback: (text: string) => void,
  key = 'content'
): () => void {
  try {
    const ytext = ydoc.getText(key);

    const observer = () => {
      callback(ytext.toString());
    };

    ytext.observe(observer);

    return () => {
      ytext.unobserve(observer);
    };
  } catch (error) {
    console.error('Failed to observe Yjs text:', error);
    return () => {};
  }
}

/**
 * Merge two Yjs documents (e.g., when syncing from remote).
 * Applies remote state to local Y.Doc and lets CRDT handle merging.
 */
export async function mergeYjsState(
  crdtId: string,
  ydoc: Y.Doc,
  remoteState: Uint8Array
): Promise<void> {
  try {
    Y.applyUpdate(ydoc, remoteState);
    // Update RxDB with the merged state
    await persistYjsState(crdtId, ydoc);
  } catch (error) {
    console.error('Failed to merge Yjs state:', crdtId, error);
    throw error;
  }
}

/**
 * Get the current encoded state of a Y.Doc (for syncing to remote)
 */
export function getYjsEncodedState(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

/**
 * Compute state vector (compact representation of what we have)
 */
export function getYjsStateVector(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(ydoc);
}

/**
 * Get only the updates needed to sync from a remote state vector
 * (useful for efficient syncing)
 */
export function getYjsSyncUpdate(ydoc: Y.Doc, stateVector: Uint8Array): Uint8Array {
  // Since encodeSyncStep2 doesn't exist in standard Yjs,
  // we compute the difference by encoding state and building a delta
  // For now, return the full state - this can be optimized later
  return Y.encodeStateAsUpdate(ydoc);
}

/**
 * Clear the Yjs doc registry (useful for tests or cleanup)
 */
export function clearYjsRegistry(): void {
  yjsDocRegistry.forEach((ydoc) => {
    ydoc.destroy();
  });
  yjsDocRegistry.clear();
}

/**
 * IndexedDB utilities for storing File System Access API handles
 * This allows persisting directory handles across page reloads
 */

const DB_NAME = "verve-storage";
const DB_VERSION = 1;
const STORE_NAME = "file-handles";

interface FileHandleRecord {
  workspaceId: string;
  directoryHandle: FileSystemDirectoryHandle;
  directoryName: string;
  timestamp: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "workspaceId" });
      }
    };
  });
}

/**
 * Store a directory handle for a workspace
 */
export async function storeDirectoryHandle(
  workspaceId: string,
  directoryHandle: FileSystemDirectoryHandle
): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const record: FileHandleRecord = {
      workspaceId,
      directoryHandle,
      directoryName: directoryHandle.name,
      timestamp: Date.now(),
    };

    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to store directory handle"));
  });
}

/**
 * Get a directory handle for a workspace
 */
export async function getDirectoryHandle(
  workspaceId: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const database = await initDB();

    const record = await new Promise<FileHandleRecord | null>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(workspaceId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("Failed to get directory handle"));
    });

    if (!record) return null;

    // Verify the handle is still valid by requesting permission
    const handle = record.directoryHandle;
    
    // Check if we still have permission
    const permission = await handle.queryPermission({ mode: "readwrite" });
    
    if (permission === "granted") {
      return handle;
    } else if (permission === "prompt") {
      // Request permission again
      const newPermission = await handle.requestPermission({ mode: "readwrite" });
      if (newPermission === "granted") {
        return handle;
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting directory handle:", error);
    return null;
  }
}

/**
 * Remove a directory handle from storage
 */
export async function removeDirectoryHandle(workspaceId: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(workspaceId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to remove directory handle"));
  });
}

/**
 * Get all stored directory handles
 */
export async function getAllDirectoryHandles(): Promise<FileHandleRecord[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error("Failed to get all directory handles"));
  });
}

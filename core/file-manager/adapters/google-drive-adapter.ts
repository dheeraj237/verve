import { toast } from "@/shared/utils/toast";
import type { FileSystemAdapter, FileData, FileMetadata } from "@/core/file-manager/types";
import { FileSystemType } from "@/core/file-manager/types";
import { requestDriveAccessToken } from "@/core/auth/google";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

function storageKey(key: string) {
  return `verve_gdrive_${key}`;
}

/* Old prompt-based picker removed in favor of native Google Picker.
   The native Picker is implemented in shared/components/google-drive-picker.tsx
   and uses Google Identity Services + gapi picker. */

async function getToken(): Promise<string | null> {
  try {
    const token = await requestDriveAccessToken(false);
    return token || null;
  } catch (err) {
    return null;
  }
}

export class GoogleDriveAdapter implements FileSystemAdapter {
  type = FileSystemType.SERVER;
  private folderId?: string;

  constructor(folderId?: string) {
    this.folderId = folderId || window.localStorage.getItem(storageKey("folder_id")) || undefined;
  }

  private async resolveFolderId(): Promise<string> {
    if (this.folderId) return this.folderId;
    const id = window.localStorage.getItem(storageKey("folder_id"));
    if (!id) throw new Error("No Google Drive folder selected");
    this.folderId = id;
    return id;
  }

  async listFiles(directory?: string): Promise<FileMetadata[]> {
    // If directory param passed, use it as the parent folder id; otherwise use configured folder
    const folderId = directory && directory.length > 0 ? directory : await this.resolveFolderId();
    const token = await getToken();
    if (!token) throw new Error("Not authenticated with Google Drive");
    const q = `'${folderId}' in parents and trashed=false`;
    const res = await fetch(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return (data.files || []).map((f: any) => ({ id: f.id, name: f.name, path: f.id, category: 'gdrive', size: Number(f.size || 0), lastModified: f.modifiedTime ? new Date(f.modifiedTime) : undefined, mimeType: f.mimeType }));
  }

  async readFile(path: string): Promise<FileData> {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated with Google Drive");

    // Fetch metadata
    const metaRes = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(path)}?fields=id,name,mimeType,modifiedTime,size`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) throw new Error("Failed to read file metadata from Google Drive");
    const meta = await metaRes.json();

    // Fetch content
    const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(path)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to read file from Google Drive");
    const content = await res.text();

    const fileData: FileData = {
      id: meta.id,
      path: meta.id,
      name: meta.name,
      category: 'gdrive',
      content,
      size: Number(meta.size || 0),
      lastModified: meta.modifiedTime ? new Date(meta.modifiedTime) : undefined,
      mimeType: meta.mimeType,
      version: meta.modifiedTime,
    } as any;

    return fileData;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const folderId = this.folderId || window.localStorage.getItem(storageKey("folder_id"));
    if (!folderId) throw new Error("No Google Drive folder selected");
    const token = await getToken();
    if (!token) throw new Error("Not authenticated with Google Drive");

    // If path is an id, update the file; otherwise create a new file with `path` as name
    if (/^[a-zA-Z0-9_-]{10,}$/.test(path)) {
      // update
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(path)}?uploadType=media`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/markdown" },
        body: content,
      });
      if (!res.ok) throw new Error("Failed to update file on Google Drive");
      return;
    }

    // create new file
    const metadata = { name: path, parents: [folderId] };
    const boundary = "-------314159265358979323846";
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
    if (!res.ok) throw new Error("Failed to create file on Google Drive");
  }

  async getFileVersion(path: string): Promise<string | undefined> {
    const token = await getToken();
    if (!token) return undefined;
    const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(path)}?fields=modifiedTime,md5Checksum`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.modifiedTime || data.md5Checksum;
  }

  async deleteFile(path: string): Promise<void> {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated with Google Drive");
    const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to delete file on Google Drive");
  }
}

export default GoogleDriveAdapter;

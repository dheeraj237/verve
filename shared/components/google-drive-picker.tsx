"use client";

import React from "react";
import { Button } from "@/shared/components/ui/button";
import { ensureGisLoaded, requestAccessTokenForScopes } from "@/core/auth/google";
import { toast } from "@/shared/utils/toast";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export function ConnectGoogleDrive({ onConnected }: { onConnected?: (folderId: string, fileId?: string) => void }) {
  async function connect() {
    try {
      const clientId = import.meta.env.VITE_AUTH_APP_CLIENT_ID;
      if (!clientId) {
        toast.error("Google Client ID not configured. Please set VITE_AUTH_APP_CLIENT_ID.");
        return;
      }

      await ensureGisLoaded();

      // Request only drive.file + basic profile scopes (no drive.readonly)
      const scopes = "https://www.googleapis.com/auth/drive.file openid profile email";
      const token = await requestAccessTokenForScopes(scopes, true);
      if (!token) {
        toast.info("Google Drive permission not granted");
        return;
      }

      // Create an application folder named 'Verve' in the user's Drive
      const folderMeta = { name: "Verve", mimeType: "application/vnd.google-apps.folder" };
      const folderRes = await fetch(`${DRIVE_API_BASE}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(folderMeta),
      });

      if (!folderRes.ok) {
        const txt = await folderRes.text();
        console.error("Failed to create Drive folder:", txt);
        toast.error("Failed to create Drive folder");
        return;
      }

      const folderJson = await folderRes.json();
      const folderId = folderJson.id;
      window.localStorage.setItem("verve_gdrive_folder_id", folderId);

      // Create an empty 'verve.md' file inside that folder
      const metadata = { name: "verve.md", parents: [folderId] };
      const boundary = "-------314159265358979323846";
      const multipartBody = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n\r\n--${boundary}--`;

      const fileRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      });

      let fileId: string | undefined = undefined;
      if (fileRes.ok) {
        const fileJson = await fileRes.json();
        fileId = fileJson.id;
        // persist verve file id for explorer to use without listing Drive
        window.localStorage.setItem("verve_gdrive_verve_file_id", fileId);
      } else {
        console.warn("Failed to create verve.md file", await fileRes.text());
      }

      // Try to enable Drive integration in editor store if available
      try {
        const storeMod = await import("@/features/editor/store/editor-store");
        if (storeMod && typeof (storeMod as any).enableGoogleDrive === "function") {
          (storeMod as any).enableGoogleDrive(folderId);
        }
        if (fileId && (storeMod as any).useEditorStore) {
          await (storeMod as any).useEditorStore.getState().loadFileFromManager(fileId);
        }
      } catch (err) {
        console.error("Failed to notify editor store about Drive connection:", err);
      }

      toast.success("Connected to Google Drive");
      if (onConnected) onConnected(folderId, fileId);
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect Google Drive");
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={connect} className="h-8 hidden sm:inline-flex">
        Connect Google Drive
      </Button>
    </div>
  );
}

export default ConnectGoogleDrive;

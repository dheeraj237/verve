"use client";

import { useEffect } from "react";
import { FileNode } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { FileTreeItem } from "./file-tree-item";
import { Loader2, FolderOpen, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";

export function FileExplorer() {
  const { fileTree, setFileTree, openLocalDirectory, isLoadingLocalFiles } = useFileExplorerStore();
  const { openLocalFile } = useEditorStore();

  useEffect(() => {
    async function loadFiles() {
      try {
        const response = await fetch("/api/files");
        const result = await response.json();
        
        if (result.success) {
          setFileTree(result.data);
        }
      } catch (error) {
        console.error("Error loading files:", error);
      }
    }

    loadFiles();
  }, [setFileTree]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-2 p-2 border-b border-sidebar-border">
        <Button
          variant="outline"
          size="sm"
          onClick={openLocalDirectory}
          disabled={isLoadingLocalFiles}
          className="flex-1 gap-2"
          title="Open folder"
        >
          {isLoadingLocalFiles ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" />
          )}
          Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={openLocalFile}
          className="flex-1 gap-2"
          title="Open file"
        >
          <FileText className="h-4 w-4" />
          File
        </Button>
      </div>

      {fileTree.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto py-2">
          {fileTree.map((node) => (
            <FileTreeItem key={node.id} node={node} level={0} parentNode={undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

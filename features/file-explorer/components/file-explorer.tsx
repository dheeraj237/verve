"use client";

import { useEffect } from "react";
import { FileNode } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { FileTreeItem } from "./file-tree-item";
import { Loader2 } from "lucide-react";

export function FileExplorer() {
  const { fileTree, setFileTree } = useFileExplorerStore();

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

  if (fileTree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto py-2">
      {fileTree.map((node) => (
        <FileTreeItem key={node.id} node={node} level={0} />
      ))}
    </div>
  );
}

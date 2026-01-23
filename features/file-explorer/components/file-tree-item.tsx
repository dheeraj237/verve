"use client";

import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { FileNode } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { cn } from "@/shared/utils/cn";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";

interface FileTreeItemProps {
  node: FileNode;
  level: number;
}

export function FileTreeItem({ node, level }: FileTreeItemProps) {
  const { expandedFolders, selectedFileId, toggleFolder, setSelectedFile } =
    useFileExplorerStore();
  const { setCurrentFile, setIsLoading } = useEditorStore();

  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFileId === node.id;

  const handleClick = async () => {
    if (node.type === "folder") {
      toggleFolder(node.id);
    } else {
      setSelectedFile(node.id);
      setIsLoading(true);

      try {
        const response = await fetch(`/api/files/${node.path}`);
        const result = await response.json();

        if (result.success) {
          setCurrentFile({
            id: node.id,
            path: node.path,
            name: node.name,
            content: result.data.content,
            category: node.path.split("/")[0],
          });
        }
      } catch (error) {
        console.error("Error loading file:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-sidebar-hover transition-colors",
          isSelected && "bg-accent"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === "folder" ? (
          <>
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform flex-shrink-0",
                isExpanded && "rotate-90"
              )}
            />
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <div className="w-4" />
            <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </>
        )}
        <span className="text-sm truncate">{node.name}</span>
      </div>

      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

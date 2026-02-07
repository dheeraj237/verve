"use client";

import { useEffect, useState } from "react";
import { FileNode } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { FileTreeItem } from "./file-tree-item";
import { Loader2, FolderOpen, FileText, FilePlus, FolderPlus, RefreshCw, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { InlineInput } from "./inline-input";
import { toast } from "@/shared/utils/toast";
import { cn } from "@/shared/utils/cn";

export function FileExplorer() {
  const {
    fileTree,
    setFileTree,
    openLocalDirectory,
    isLoadingLocalFiles,
    refreshFileTree,
    toggleCollapseExpand,
    expandedFolders,
    createFile,
    createFolder,
    currentDirectoryName,
    currentDirectoryPath,
    setCurrentDirectory,
  } = useFileExplorerStore();
  const { openLocalFile } = useEditorStore();
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    async function loadFiles() {
      try {
        const response = await fetch("/api/files");
        const result = await response.json();
        
        if (result.success) {
          setFileTree(result.data);
          // Set default directory name for server files
          if (!currentDirectoryName) {
            setCurrentDirectory('content', '/content');
          }
        }
      } catch (error) {
        console.error("Error loading files:", error);
      }
    }

    loadFiles();
  }, [setFileTree, currentDirectoryName, setCurrentDirectory]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFileTree();
    } catch (error) {
      toast.error('Refresh failed', (error as Error).message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleCollapseExpand = () => {
    toggleCollapseExpand();
  };

  const handleNewFile = () => {
    if (fileTree.length === 0) {
      toast.error('No workspace', 'Open a folder first');
      return;
    }
    setNewItemType('file');
  };

  const handleNewFolder = () => {
    if (fileTree.length === 0) {
      toast.error('No workspace', 'Open a folder first');
      return;
    }
    setNewItemType('folder');
  };

  const handleNewItemConfirm = async (name: string) => {
    setNewItemType(null);
    const itemType = newItemType === 'file' ? 'File' : 'Folder';
    const toastId = toast.loading(`Creating ${itemType.toLowerCase()}...`, name);

    try {
      // Create at root level (use empty string or first node's parent path)
      const rootPath = fileTree[0]?.id || '';
      if (newItemType === 'file') {
        await createFile(rootPath, name);
      } else if (newItemType === 'folder') {
        await createFolder(rootPath, name);
      }
      toast.dismiss(toastId);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(`Failed to create ${itemType.toLowerCase()}`, (error as Error).message);
    }
  };

  const getExistingNames = (): string[] => {
    return fileTree.map(node => node.name);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Static Explorer heading */}
      <div className="px-4 py-2 border-b border-sidebar-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Explorer
        </h2>
      </div>

      {/* Directory name with action buttons */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-sidebar-border">
        <h3
          className="text-xs font-semibold text-foreground truncate flex-1 mr-2"
          title={currentDirectoryPath || undefined}
        >
          {currentDirectoryName || 'No folder open'}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewFile}
            disabled={fileTree.length === 0}
            className="h-6 w-6 hover:bg-sidebar-hover cursor-pointer"
            title="New File"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewFolder}
            disabled={fileTree.length === 0}
            className="h-6 w-6 hover:bg-sidebar-hover cursor-pointer"
            title="New Folder"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || fileTree.length === 0}
            className="h-6 w-6 hover:bg-sidebar-hover cursor-pointer"
            title="Refresh Explorer"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleCollapseExpand}
            disabled={fileTree.length === 0}
            className="h-6 w-6 hover:bg-sidebar-hover cursor-pointer"
            title={expandedFolders.size > 0 ? "Collapse All" : "Expand All"}
          >
            {expandedFolders.size > 0 ? (
              <ChevronsDownUp className="h-4 w-4" />
            ) : (
              <ChevronsUpDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* File tree - scrollable area */}
      {fileTree.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center text-muted-foreground text-sm">
            <p>No folder open</p>
            <p className="text-xs mt-1">Open a folder to get started</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* New item input at root */}
          {newItemType && (
            <InlineInput
              type={newItemType}
              level={0}
              defaultValue={newItemType === 'file' ? 'newfile.md' : 'newfolder'}
              onConfirm={handleNewItemConfirm}
              onCancel={() => setNewItemType(null)}
              existingNames={getExistingNames()}
            />
          )}
          {fileTree.map((node) => (
            <FileTreeItem key={node.id} node={node} level={0} parentNode={undefined} />
          ))}
        </div>
      )}

      {/* Open folder/file buttons at bottom */}
      <div className="flex gap-2 p-2 border-t border-sidebar-border mt-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={openLocalDirectory}
          disabled={isLoadingLocalFiles}
          className="flex-1 gap-2 text-xs cursor-pointer"
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
          className="flex-1 gap-2 text-xs cursor-pointer"
          title="Open file"
        >
          <FileText className="h-4 w-4" />
          File
        </Button>
      </div>
    </div>
  );
}

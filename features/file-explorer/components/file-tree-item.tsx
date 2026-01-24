"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { FileNode } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { cn } from "@/shared/utils/cn";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { ContextMenu } from "./context-menu";
import { InlineInput } from "./inline-input";

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  parentNode?: FileNode;
}

export function FileTreeItem({ node, level, parentNode }: FileTreeItemProps) {
  const { expandedFolders, selectedFileId, toggleFolder, setSelectedFile, createFile, createFolder, renameNode, deleteNode } =
    useFileExplorerStore();
  const { openFile, setIsLoading } = useEditorStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickCountRef = useRef(0);

  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFileId === node.id;

  // Get sibling names for duplicate checking
  const getSiblingNames = (): string[] => {
    if (parentNode && parentNode.children) {
      return parentNode.children
        .filter(child => child.id !== node.id)
        .map(child => child.name);
    }
    return [];
  };

  // Get children names for new item duplicate checking
  const getChildrenNames = (): string[] => {
    if (node.children) {
      return node.children.map(child => child.name);
    }
    return [];
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Handle double-click for renaming
    clickCountRef.current++;

    if (clickCountRef.current === 1) {
      clickTimeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        // Single click behavior
        if (node.type === "folder") {
          toggleFolder(node.id);
        } else {
          setSelectedFile(node.id);
          loadFile();
        }
      }, 300);
    } else if (clickCountRef.current === 2) {
      // Double click - start renaming
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      clickCountRef.current = 0;
      setIsRenaming(true);
    }
  };

  const loadFile = async () => {
    setIsLoading(true);

    try {
      // Check if this is a local file
      if (node.id.startsWith('local-file-')) {
        // Read file from local file system
        const dirHandle = (window as any).__localDirHandle;
        if (!dirHandle) {
          throw new Error('No directory handle available');
        }

        const pathParts = node.path.split('/');
        let currentHandle = dirHandle;

        // Navigate to the file through directory structure
        for (let i = 0; i < pathParts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
        }

        const fileHandle = await currentHandle.getFileHandle(pathParts[pathParts.length - 1]);
        const file = await fileHandle.getFile();
        const content = await file.text();

        openFile({
          id: node.id,
          path: node.path,
          name: node.name,
          content,
          category: 'local',
          fileHandle,
          isLocal: true,
        });
      } else {
      // Load from server
        const response = await fetch(`/api/files/${node.path}`);
        const result = await response.json();

        if (result.success) {
          openFile({
            id: node.id,
            path: node.path,
            name: node.name,
            content: result.data.content,
            category: node.path.split("/")[0],
          });
        }
      }
    } catch (error) {
      console.error("Error loading file:", error);
      alert('Failed to load file: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleNewFile = () => {
    setContextMenu(null);
    if (node.type === 'folder') {
      if (!isExpanded) {
        toggleFolder(node.id);
      }
      setNewItemType('file');
    }
  };

  const handleNewFolder = () => {
    setContextMenu(null);
    if (node.type === 'folder') {
      if (!isExpanded) {
        toggleFolder(node.id);
      }
      setNewItemType('folder');
    }
  };

  const handleRename = () => {
    setContextMenu(null);
    setIsRenaming(true);
  };

  const handleDelete = async () => {
    setContextMenu(null);
    const confirmMsg = node.type === 'folder'
      ? `Delete folder "${node.name}" and all its contents?`
      : `Delete file "${node.name}"?`;

    if (confirm(confirmMsg)) {
      try {
        await deleteNode(node.path, node.type === 'folder');
      } catch (error) {
        alert('Failed to delete: ' + (error as Error).message);
      }
    }
  };

  const handleRenameConfirm = async (newName: string) => {
    setIsRenaming(false);
    if (newName === node.name) return;

    try {
      await renameNode(node.path, newName);
    } catch (error) {
      alert('Failed to rename: ' + (error as Error).message);
    }
  };

  const handleNewItemConfirm = async (name: string) => {
    setNewItemType(null);
    try {
      if (newItemType === 'file') {
        await createFile(node.id, name);
      } else if (newItemType === 'folder') {
        await createFolder(node.id, name);
      }
    } catch (error) {
      alert(`Failed to create ${newItemType}: ` + (error as Error).message);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolder(node.id);
  };

  // Render inline input for renaming
  if (isRenaming) {
    return (
      <InlineInput
        type={node.type}
        level={level}
        defaultValue={node.name}
        onConfirm={handleRenameConfirm}
        onCancel={() => setIsRenaming(false)}
        existingNames={getSiblingNames()}
      />
    );
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-sidebar-hover transition-colors",
          isSelected && "bg-accent"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.type === "folder" ? (
          <>
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform flex-shrink-0 cursor-pointer",
                isExpanded && "rotate-90"
              )}
              onClick={handleChevronClick}
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onRename={handleRename}
          onDelete={handleDelete}
          isFolder={node.type === 'folder'}
        />
      )}

      {node.type === "folder" && isExpanded && (
        <div>
          {/* Show new item input at the top of children */}
          {newItemType && (
            <InlineInput
              type={newItemType}
              level={level + 1}
              defaultValue={newItemType === 'file' ? 'newfile.md' : 'newfolder'}
              onConfirm={handleNewItemConfirm}
              onCancel={() => setNewItemType(null)}
              existingNames={getChildrenNames()}
            />
          )}

          {/* Render children */}
          {node.children?.map((child) => (
            <FileTreeItem key={child.id} node={child} level={level + 1} parentNode={node} />
          ))}
        </div>
      )}
    </div>
  );
}

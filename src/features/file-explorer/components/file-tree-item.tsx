import { useState, useRef, useEffect } from "react";
import { ChevronRight, File, Folder, FolderOpen, FilePlus, FolderPlus } from "lucide-react";
import { FileNode, FileCategory, FileNodeType } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { cn } from "@/shared/utils/cn";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { FileContextMenu } from "./context-menu";
import { InlineInput } from "./inline-input";
import { toast } from "@/shared/utils/toast";
import { Button } from "@/shared/components/ui/button";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import { loadFile as loadFileData } from "@/core/cache";
import { WorkspaceType } from '@/core/cache/types';

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  parentNode?: FileNode;
}

export function FileTreeItem({ node, level, parentNode }: FileTreeItemProps) {
  const { expandedFolders, selectedFileId, toggleFolder, setSelectedFile, createFile, createFolder, renameNode, deleteNode } =
    useFileExplorerStore();
  const { openFile, setIsLoading } = useEditorStore();

  const [isRenaming, setIsRenaming] = useState(false);
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [isHovered, setIsHovered] = useState(false);

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

    // Single click behavior - VSCode style
    if (node.type === FileNodeType.Folder) {
      toggleFolder(node.id);
    } else {
      setSelectedFile(node.id);
      loadFile();
    }
  };

  const handleTouch = (e: React.TouchEvent) => {
    e.stopPropagation();

    // Single tap behavior - same as click for mobile
    if (node.type === FileNodeType.Folder) {
      toggleFolder(node.id);
    } else {
      setSelectedFile(node.id);
      loadFile();
    }
  };

  const loadFile = async () => {
    setIsLoading(true);

    try {
      // Get active workspace to determine how to load the file
      const activeWorkspace = useWorkspaceStore.getState().activeWorkspace();

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
          category: FileCategory.Local,
          fileHandle,
          isLocal: true,
        });
      } else if (node.id.startsWith('gdrive-')) {
        // Google Drive file - load from RxDB cache
        if (!activeWorkspace || activeWorkspace.type !== WorkspaceType.GDrive) {
          throw new Error('No Google Drive workspace active');
        }

        const fileData = await loadFileData(node.path, WorkspaceType.GDrive);

        openFile({
          id: node.id,
          path: node.path,
          name: node.name,
          content: fileData.content,
          category: FileCategory.GDrive,
        });
      } else if (node.id.startsWith('samples-') && activeWorkspace?.id === 'verve-samples') {
        // Load from verve-samples workspace from RxDB cache
        const fileData = await loadFileData(node.path, WorkspaceType.Browser);

        openFile({
          id: node.id,
          path: node.path,
          name: node.name,
          content: fileData.content,
          category: FileCategory.Browser,
        });
      } else if (activeWorkspace?.type === WorkspaceType.Browser && activeWorkspace.id !== 'verve-samples') {
        // Browser workspace (non-samples) - load from RxDB cache
        const fileData = await loadFileData(node.path, WorkspaceType.Browser);

        openFile({
          id: node.id,
          path: node.path,
          name: node.name,
          content: fileData.content,
          category: FileCategory.Browser,
        });
      } else {
        // Fallback: attempt to load from public directory (relative path for Vite)
        const response = await fetch(`content${node.path}`);
        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.statusText}`);
        }
        const content = await response.text();

        openFile({
          id: node.id,
          path: node.path,
          name: node.name,
          content,
          category: (node.path.split("/")[1] as FileCategory) || FileCategory.Browser,
        });
      }
    } catch (error) {
      console.error("Error loading file:", error);
      alert('Failed to load file: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleFolder(node.id);
    }
    setNewItemType('file');
  };

  const handleNewFileTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleFolder(node.id);
    }
    setNewItemType('file');
  };

  const handleNewFolderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleFolder(node.id);
    }
    setNewItemType('folder');
  };

  const handleNewFolderTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleFolder(node.id);
    }
    setNewItemType('folder');
  };

  const handleNewFile = () => {
    if (node.type === 'folder') {
      if (!isExpanded) {
        toggleFolder(node.id);
      }
      setNewItemType('file');
    }
  };

  const handleNewFolder = () => {
    if (node.type === 'folder') {
      if (!isExpanded) {
        toggleFolder(node.id);
      }
      setNewItemType('folder');
    }
  };

  const handleRename = () => {
    setIsRenaming(true);
  };

  const handleDelete = async () => {
    const confirmMsg = node.type === 'folder'
      ? `Delete folder "${node.name}" and all its contents?`
      : `Delete file "${node.name}"?`;

    if (confirm(confirmMsg)) {
      const toastId = toast.loading(`Deleting ${node.type}...`, node.name);
      try {
        await deleteNode(node.path, node.type === 'folder');
        toast.dismiss(toastId);
      } catch (error) {
        toast.dismiss(toastId);
        toast.error('Delete failed', (error as Error).message);
      }
    }
  };

  const handleRenameConfirm = async (newName: string) => {
    setIsRenaming(false);
    if (newName === node.name) return;

    const toastId = toast.loading('Renaming...', `${node.name} → ${newName}`);
    try {
      await renameNode(node.path, newName);
      toast.dismiss(toastId);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Rename failed', (error as Error).message);
    }
  };

  const handleNewItemConfirm = async (name: string) => {
    setNewItemType(null);
    const itemType = newItemType === 'file' ? 'File' : 'Folder';
    const toastId = toast.loading(`Creating ${itemType.toLowerCase()}...`, name);

    try {
      // Log the selected parent path and expected final path for debugging
      const parentPath = node.path || '';
      const expectedPath = parentPath ? `${parentPath}/${name}` : name;
      console.info(`[FileExplorer] Creating ${itemType} - parent: '${parentPath}', name: '${name}', expectedPath: '${expectedPath}'`);

      if (newItemType === 'file') {
        await createFile(parentPath, name);
      } else if (newItemType === 'folder') {
        await createFolder(parentPath, name);
      }
      toast.dismiss(toastId);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(`Failed to create ${itemType.toLowerCase()}`, (error as Error).message);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolder(node.id);
  };

  const handleChevronTouch = (e: React.TouchEvent) => {
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
      <FileContextMenu
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onRename={handleRename}
        onDelete={handleDelete}
        isFolder={node.type === 'folder'}
      >
        <div
          className={cn(
            "group flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-sidebar-hover transition-colors relative",
            isSelected && "bg-accent"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={handleClick}
          onTouchEnd={handleTouch}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {node.type === "folder" ? (
            <>
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform shrink-0 cursor-pointer",
                  isExpanded && "rotate-90"
                )}
                onClick={handleChevronClick}
                onTouchEnd={handleChevronTouch}
              />
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Folder className="h-4 w-4 text-primary shrink-0" />
              )}
            </>
          ) : (
            <>
              <div className="w-4" />
              <File className="h-4 w-4 text-muted-foreground shrink-0" />
            </>
          )}
          <span className="text-sm truncate flex-1">{node.name}</span>

          {/* Folder hover actions - VSCode style */}
          {node.type === "folder" && isHovered && (
            <div className="flex items-center gap-0.5 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewFileClick}
                onTouchEnd={handleNewFileTouch}
                className="h-5 w-5 hover:bg-sidebar-hover opacity-0 group-hover:opacity-100 transition-opacity"
                title="New File"
              >
                <FilePlus className="cursor-pointer h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewFolderClick}
                onTouchEnd={handleNewFolderTouch}
                className="h-5 w-5 hover:bg-sidebar-hover opacity-0 group-hover:opacity-100 transition-opacity"
                title="New Folder"
              >
                <FolderPlus className="cursor-pointer h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </FileContextMenu>

      {node.type === "folder" && isExpanded && (
        <div>
          {/* Show new item input at the top of children */}
          {newItemType && (
            <InlineInput
              type={newItemType}
              level={level + 1}
              defaultValue={newItemType === 'file' ? 'untitled.md' : 'untitled'}
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

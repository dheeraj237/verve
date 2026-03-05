import { useState, useRef, useEffect } from "react";
import { ChevronRight, File, Folder, FolderOpen, FilePlus, FolderPlus } from "lucide-react";
import { FileNode, FileType } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { cn } from "@/shared/utils/cn";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { FileContextMenu } from "./context-menu";
import { InlineInput } from "./inline-input";
import { toast } from "@/shared/utils/toast";
import { Button } from "@/shared/components/ui/button";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import { loadFile as loadFileData, subscribeToFileChanges, getCachedFile, getDirtyFiles } from "@/core/cache/file-manager";
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

  // Selectors used during render - keep at top-level to avoid conditional hooks
  const getChildrenSelector = useFileExplorerStore(state => state.getChildren);
  const fileMapSelector = useFileExplorerStore(state => state.fileMap);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newItemType, setNewItemType] = useState<FileType>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFileId === node.id;

  useEffect(() => {
    let mounted = true;

    const activeWs = useWorkspaceStore.getState().activeWorkspace?.();

    // Initial check
    (async () => {
      try {
        if (node.type === FileType.File) {
          const cached = await getCachedFile(node.path || node.id, activeWs?.id);
          if (mounted) setIsDirty(!!(cached && (cached as any).dirty));
        } else {
          const dirty = await getDirtyFiles(activeWs?.id);
          const any = dirty.some((f) => (f.path || '').replace(/^\/*/, '').startsWith((node.path || '').replace(/^\/*/, '')));
          if (mounted) setIsDirty(any);
        }
      } catch (err) {
        // ignore
      }
    })();

    const unsub = subscribeToFileChanges((files: any[]) => {
      try {
        if (node.type === FileType.File) {
          const found = files.find((f) => String(f.path) === String(node.path) || String(f.id) === String(node.id));
          setIsDirty(!!(found && found.dirty));
        } else {
          const any = files.some((f) => (f.path || '').replace(/^\/*/, '').startsWith((node.path || '').replace(/^\/*/, '')) && f.dirty);
          setIsDirty(any);
        }
      } catch (err) {
        // ignore
      }
    });

    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        // ignore
      }
      mounted = false;
    };
  }, [node.id, node.path, node.type]);

  // Get sibling names for duplicate checking
  const getSiblingNames = (): string[] => {
    try {
      if (parentNode && Array.isArray(parentNode.children) && parentNode.children.length) {
        // children might be object nodes or id strings
        const first = parentNode.children[0];
        if (typeof first === 'object') {
          return (parentNode.children as any[])
            .filter(child => child.id !== node.id)
            .map(child => child.name);
        }
      }
      if (parentNode) {
        const childIds = useFileExplorerStore.getState().getChildren(parentNode.id) || [];
        const map = useFileExplorerStore.getState().fileMap || {};
        return childIds
          .filter((id) => id !== node.id)
          .map((id) => map[id]?.name)
          .filter(Boolean) as string[];
      }
    } catch (e) {
      // ignore
    }
    return [];
  };

  // Get children names for new item duplicate checking
  const getChildrenNames = (): string[] => {
    try {
      if (Array.isArray(node.children) && node.children.length) {
        const first = node.children[0];
        if (typeof first === 'object') {
          return (node.children as any[]).map(child => child.name);
        }
        // children are ids
        const map = useFileExplorerStore.getState().fileMap || {};
        return (node.children as any).map(id => map[id]?.name).filter(Boolean) as string[];
      }
      const childIds = useFileExplorerStore.getState().getChildren(node.id) || [];
      const map = useFileExplorerStore.getState().fileMap || {};
      return childIds.map(id => map[id]?.name).filter(Boolean) as string[];
    } catch (e) {
      return [];
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Single click behavior - VSCode style
    if (node.type === FileType.Directory) {
      toggleFolder(node.id);
    } else {
      setSelectedFile(node.id);
      loadFile();
    }
  };

  const handleTouch = (e: React.TouchEvent) => {
    e.stopPropagation();

    // Single tap behavior - same as click for mobile
    if (node.type === FileType.Directory) {
      toggleFolder(node.id);
    } else {
      setSelectedFile(node.id);
      loadFile();
    }
  };

  const loadFile = async () => {
    setIsLoading(true);
    const startTime = performance.now();
    console.log(`[FileTreeItem] Loading file:`, {
      nodeId: node.id,
      nodePath: node.path,
      nodeName: node.name,
      nodeWorkspaceType: node.workspaceType,
      nodeWorkspaceId: node.workspaceId,
    });

    try {
      // Use file-manager to load file content with node's workspace context
      const fileData = await loadFileData(
        node.path,
        node.workspaceType || WorkspaceType.Browser,
        node.workspaceId
      );

      console.log(`[FileTreeItem] File data loaded:`, {
        id: fileData?.id,
        path: fileData?.path,
        contentLength: fileData?.content?.length || 0,
      });

      openFile({
        ...fileData,
        id: fileData?.id || node.id,
        path: node.path,
        name: node.name,
        content: fileData?.content || '',
      } as FileNode);
    } catch (error) {
      console.error("Error loading file:", error);
      alert('Failed to load file: ' + (error as Error).message);
    } finally {
      const elapsed = performance.now() - startTime;
      console.log(`[FileTreeItem] File loading completed in ${elapsed.toFixed(2)}ms`);
      setIsLoading(false);
    }
  };

  const handleNewFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleFolder(node.id);
    }
    setNewItemType(FileType.File);
  };

  const handleNewFileTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleFolder(node.id);
    }
    setNewItemType(FileType.File);
  };

  const handleNewFolderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleFolder(node.id);
    }
    setNewItemType(FileType.Directory);
  };

  const handleNewFolderTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleFolder(node.id);
    }
    setNewItemType(FileType.Directory);
  };

  const handleNewFile = () => {
    if (node.type === FileType.Directory) {
      if (!isExpanded) {
        toggleFolder(node.id);
      }
      setNewItemType(FileType.File);
    }
  };

  const handleNewFolder = () => {
    if (node.type === FileType.Directory) {
      if (!isExpanded) {
        toggleFolder(node.id);
      }
      setNewItemType(FileType.Directory);
    }
  };

  const handleRename = () => {
    setIsRenaming(true);
  };

  const handleDelete = async () => {
    const confirmMsg = node.type === FileType.Directory
      ? `Delete folder "${node.name}" and all its contents?`
      : `Delete file "${node.name}"?`;

    if (confirm(confirmMsg)) {
      const toastId = toast.loading(`Deleting ${node.type}...`, node.name);
      try {
        await deleteNode(node.path, node.type === FileType.Directory);
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
    const itemType = newItemType === FileType.File ? 'File' : 'Folder';
    setNewItemType(null);
    const toastId = toast.loading(`Creating ${itemType.toLowerCase()}...`, name);

    try {
      // Log the selected parent path and expected final path for debugging
      const parentPath = node.path || '';
      const expectedPath = parentPath ? `${parentPath}/${name}` : name;
      console.info(`[FileExplorer] Creating ${itemType} - parent: '${parentPath}', name: '${name}', expectedPath: '${expectedPath}'`);

      if (newItemType === FileType.File) {
        await createFile(parentPath, name);
      } else if (newItemType === FileType.Directory) {
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
        isFolder={node.type === FileType.Directory}
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
          {node.type === FileType.Directory ? (
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

          {/* Dirty indicator: small yellow dot for active-workspace dirty files/folders */}
          {isDirty && (
            <span className="ml-2 mr-1 h-2 w-2 rounded-full bg-yellow-400 inline-block" aria-label="unsynced" />
          )}

          {/* Folder hover actions - VSCode style */}
          {node.type === FileType.Directory && isHovered && (
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

      {node.type === FileType.Directory && isExpanded && (
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

          {/* Render children: support both object-child trees (from filtered getFileTree)
              and id-based children (canonical `fileMap` + `getChildren`). */}
          {(() => {
            // If node has object children (from getFileTree/filter), render them directly
            if (Array.isArray(node.children) && node.children.length && typeof node.children[0] === 'object') {
              return (node.children as any[]).map((childObj) => (
                <FileTreeItem key={childObj.id} node={childObj} level={level + 1} parentNode={node} />
              ));
            }

            // Otherwise use the id-based selector and fileMap
            const childrenIds = getChildrenSelector(node.id) || [];
            const map = fileMapSelector || {};
            return childrenIds.map((cid) => {
              const childNode = map?.[cid];
              if (!childNode) return null;
              return <FileTreeItem key={childNode.id} node={childNode} level={level + 1} parentNode={node} />;
            });
          })()}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { FileNode } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { FileTreeItem } from "./file-tree-item";
import { FilePlus, FolderPlus, RefreshCw, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { InlineInput } from "./inline-input";
import { toast } from "@/shared/utils/toast";
import { cn } from "@/shared/utils/cn";
import { initializeDemoFileTree } from "@/utils/demo-file-tree";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import { FileTreeFilter } from "./file-tree-filter";

export function FileExplorer() {
  const {
    fileTree,
    setFileTree,
    refreshFileTree,
    toggleCollapseExpand,
    expandedFolders,
    createFile,
    createFolder,
    currentDirectoryName,
    currentDirectoryPath,
    setCurrentDirectory,
  } = useFileExplorerStore();
  const { activeWorkspace } = useWorkspaceStore();
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [filterValue, setFilterValue] = useState("");

  useEffect(() => {
    async function loadFiles() {
      // Prevent loading demo files if workspace restoration is in progress
      if (hasInitialized) return;
      setHasInitialized(true);

      try {
        const currentWorkspace = activeWorkspace();

        // Only load demo files for Verve Samples workspace
        if (currentWorkspace?.type === 'browser' && currentWorkspace.id === 'verve-samples') {
          // Load demo files from localStorage
          const demoFileTree = await initializeDemoFileTree();

          if (demoFileTree && demoFileTree.length > 0) {
            setFileTree(demoFileTree);
            // Set default directory name for demo files
            if (!currentDirectoryName) {
              setCurrentDirectory('Verve Samples', '/demo');
            }
          }
        }
        // For all other workspaces (including other browser workspaces),
        // the WorkspaceDropdown component will handle restoration via its useEffect
      } catch (error) {
        console.error("Error loading demo files:", error);
      }
    }

    loadFiles();
  }, [setFileTree, currentDirectoryName, setCurrentDirectory, activeWorkspace, hasInitialized]);

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

  // Filter file tree based on search query
  const filterFileTree = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query.trim()) return nodes;

    const lowerQuery = query.toLowerCase();

    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce((acc: FileNode[], node) => {
        const nameMatches = node.name.toLowerCase().includes(lowerQuery);
        const children = node.children ? filterNodes(node.children) : [];

        if (nameMatches || children.length > 0) {
          acc.push({
            ...node,
            children: children.length > 0 ? children : node.children,
          });
        }

        return acc;
      }, []);
    };

    return filterNodes(nodes);
  };

  const filteredFileTree = filterFileTree(fileTree, filterValue);

  return (
    <div className="h-full flex flex-col">
      {/* File tree filter */}
      <FileTreeFilter onFilterChange={setFilterValue} />

      {/* Directory name with action buttons */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-sidebar-border">
        <h3
          className="text-xs font-medium text-foreground truncate flex-1 mr-2"
          title={currentDirectoryPath || undefined}
        >
          {currentDirectoryName || 'No folder open'}
        </h3>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewFile}
            disabled={fileTree.length === 0}
            className="h-5 w-5 hover:bg-sidebar-hover cursor-pointer"
            title="New File"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewFolder}
            disabled={fileTree.length === 0}
            className="h-5 w-5 hover:bg-sidebar-hover cursor-pointer"
            title="New Folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || fileTree.length === 0}
            className="h-5 w-5 hover:bg-sidebar-hover cursor-pointer"
            title="Refresh Explorer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleCollapseExpand}
            disabled={fileTree.length === 0}
            className="h-5 w-5 hover:bg-sidebar-hover cursor-pointer"
            title={expandedFolders.size > 0 ? "Collapse All" : "Expand All"}
          >
            {expandedFolders.size > 0 ? (
              <ChevronsDownUp className="h-3.5 w-3.5" />
            ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
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
            {filteredFileTree.length > 0 ? (
              filteredFileTree.map((node) => (
                <FileTreeItem key={node.id} node={node} level={0} parentNode={undefined} />
            ))
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No files match filter
              </div>
            )}
          </div>
      )}
    </div>
  );
}

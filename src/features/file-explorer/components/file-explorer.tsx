import { useEffect, useState } from "react";
import { FileNode } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { FileTreeItem } from "./file-tree-item";
import { FilePlus, FolderPlus, RefreshCw, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { InlineInput } from "./inline-input";
import { toast } from "@/shared/utils/toast";
import { cn } from "@/shared/utils/cn";
import { initializeSamplesFileTree } from "@/utils/demo-file-tree";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import { WorkspaceType } from '@/core/cache/types';
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

        // Only load Verve Samples files for the samples workspace
        if (currentWorkspace?.type === WorkspaceType.Browser && currentWorkspace.id === 'verve-samples') {
          // Load sample files from browser adapter/localStorage
          const demoFileTree = await initializeSamplesFileTree();

          if (demoFileTree && demoFileTree.length > 0) {
            setFileTree(demoFileTree);
            // Set default directory name for samples
            if (!currentDirectoryName) {
              setCurrentDirectory('Verve Samples', '/samples');
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
    const currentWorkspace = activeWorkspace();
    if (!currentWorkspace) {
      toast.error('No workspace', 'Please create or select a workspace first');
      return;
    }
    setNewItemType('file');
  };

  const handleNewFolder = () => {
    const currentWorkspace = activeWorkspace();
    if (!currentWorkspace) {
      toast.error('No workspace', 'Please create or select a workspace first');
      return;
    }
    setNewItemType('folder');
  };

  const handleNewItemConfirm = async (name: string) => {
    setNewItemType(null);
    const itemType = newItemType === 'file' ? 'File' : 'Folder';
    const toastId = toast.loading(`Creating ${itemType.toLowerCase()}...`, name);

    try {
      // Determine root path based on workspace type and file tree
      let rootPath = '';
      const currentWorkspace = activeWorkspace();

      // Top-level create from the explorer header should always create at
      // the workspace root. For Drive workspaces, use the configured
      // `driveFolder` as the root; otherwise use empty string.
      if (currentWorkspace?.type === WorkspaceType.Drive && currentWorkspace.driveFolder) {
        rootPath = currentWorkspace.driveFolder;
      } else {
        rootPath = '';
      }
      // For browser and local, empty string is fine

      // Defensive: if the computed rootPath points to a file node (e.g. tree contains
      // a top-level file like 'verve.md'), treat header creates as root (empty '')
      // to avoid creating under that file (e.g. 'verve.md/newfile.md').
      const isFileAtRoot = fileTree.some(n => n.type === 'file' && (n.path === rootPath || n.path === `/${rootPath}`));
      if (isFileAtRoot) {
        rootPath = '';
      }

      // Log selected parent path and expected path for debugging
      const expected = rootPath ? `${rootPath}/${name}` : name;
      console.info(`[FileExplorer] Creating ${itemType} - parent: '${rootPath}', name: '${name}', expectedPath: '${expected}'`);

      // (No DOM event emitted here — console.info above is sufficient for debugging)

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
            disabled={!activeWorkspace()}
            className="h-5 w-5 hover:bg-sidebar-hover cursor-pointer"
            title="New File"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewFolder}
            disabled={!activeWorkspace()}
            className="h-5 w-5 hover:bg-sidebar-hover cursor-pointer"
            title="New Folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || !activeWorkspace()}
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
        {fileTree.length === 0 && !newItemType ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground text-sm">
              <p>No files yet</p>
              <p className="text-xs mt-1">Click + to create your first file</p>
            </div>
          </div>
        ) : (
          filteredFileTree.length > 0 ? (
            filteredFileTree.map((node) => (
              <FileTreeItem key={node.id} node={node} level={0} parentNode={undefined} />
            ))
            ) : (
                fileTree.length > 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No files match filter
              </div>
                )
              )
        )}
      </div>
    </div>
  );
}

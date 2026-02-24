import { useEffect, useState } from "react";
import { FileNode } from "@/shared/types";
import { useFileExplorerStore } from "../store/file-explorer-store";
import { FileTreeItem } from "./file-tree-item";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { InlineInput } from "./inline-input";
import { toast } from "@/shared/utils/toast";
import { initializeDemoFileTree } from "@/utils/demo-file-tree";
import { useWorkspaceStore } from "@/core/store/workspace-store";

export function EmbeddedFileExplorer() {
  const {
    fileTree,
    setFileTree,
    openLocalDirectory,
    isLoadingLocalFiles,
    createFile,
    createFolder,
    currentDirectoryName,
    setCurrentDirectory,
  } = useFileExplorerStore();
  const { openLocalFile } = useEditorStore();
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);

  useEffect(() => {
    async function loadFiles() {
      try {
        // Only load demo files for Verve Samples workspace
        const currentWorkspace = useWorkspaceStore.getState().activeWorkspace();

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
      } catch (error) {
        console.error("Error loading demo files:", error);
      }
    }

    loadFiles();
  }, [setFileTree, currentDirectoryName, setCurrentDirectory]);

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
      {/* File tree - scrollable area */}
      {fileTree.length === 0 ? (
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="text-center text-muted-foreground text-sm">
            <p>No folder open</p>
            <p className="text-xs mt-1">Open a folder to get started</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* New item input at root */}
          {newItemType && (
            <div className="px-2">
              <InlineInput
                type={newItemType}
                level={0}
                defaultValue={newItemType === 'file' ? 'newfile.md' : 'newfolder'}
                onConfirm={handleNewItemConfirm}
                onCancel={() => setNewItemType(null)}
                existingNames={getExistingNames()}
              />
            </div>
          )}
          <div className="px-2">
            {fileTree.map((node) => (
              <FileTreeItem key={node.id} node={node} level={0} parentNode={undefined} />
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
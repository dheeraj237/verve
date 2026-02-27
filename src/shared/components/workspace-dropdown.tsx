import { useState, useEffect } from "react";
import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { 
  Plus, 
  FolderOpen, 
  Cloud, 
  Globe, 
  Trash,
  MoreHorizontal,
  ChevronDown,
  AlertTriangle
} from "lucide-react";
import { useWorkspaceStore, Workspace } from "@/core/store/workspace-store";
import { WorkspaceType } from '@/core/cache/types';
import { runWithLoading } from '@/core/loading/run-with-loading';
import { useFileExplorerStore } from "@/features/file-explorer/store/file-explorer-store";
import { cn } from "@/shared/utils/cn";
import { toast } from "@/shared/utils/toast";
import { WorkspaceTypePicker } from "@/shared/components/workspace-type-picker";
import { requestDriveAccessToken } from "@/core/auth/google";

interface WorkspaceDropdownProps {
  className?: string;
}

export function WorkspaceDropdown({ className }: WorkspaceDropdownProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [selectedWorkspaceType, setSelectedWorkspaceType] = useState<Workspace['type']>(WorkspaceType.Browser);
  const [isSwitching, setIsSwitching] = useState(false);
  
  const { 
    workspaces, 
    activeWorkspace, 
    isWorkspacePickerOpen, 
    setWorkspacePickerOpen,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace
  } = useWorkspaceStore();

  const { openLocalDirectory, restoreLocalDirectory, requestPermissionForWorkspace, setGoogleFolder, setSelectedFile, refreshFileTree, clearLocalDirectory, isSyncingDrive, pendingSyncCount } = useFileExplorerStore();

  const currentWorkspace = activeWorkspace();

  // Initialize default Verve Samples workspace if it doesn't exist
  React.useEffect(() => {
    // Check if Verve Samples workspace already exists
    const verveSamplesExists = workspaces.some(w => w.id === 'verve-samples');

    if (!verveSamplesExists) {
      // Create the permanent Verve Samples workspace with a fixed ID
      createWorkspace("Verve Samples", WorkspaceType.Browser, { id: 'verve-samples' });
    }
  }, [workspaces, createWorkspace]);

  // Restore workspace on mount
  React.useEffect(() => {
    const restoreOnLoad = async () => {
      // If no workspace exists, the other useEffect will create a default one
      if (!currentWorkspace) return;

      try {
        // Clear any previously selected file so selection doesn't point to another workspace's file
        setSelectedFile(null);

        // Clear any stale local directory handle first
        clearLocalDirectory();

        if (currentWorkspace.type === WorkspaceType.Local) {
          const restored = await restoreLocalDirectory(currentWorkspace.id);
          if (!restored) {
            console.warn('Failed to restore local directory on mount');
            // Don't show error toast on mount, user will see empty tree
          }
          } else if (currentWorkspace.type === WorkspaceType.Drive && currentWorkspace.driveFolder) {
          // Set the Google Drive folder for this workspace
          if (setGoogleFolder) {
            setGoogleFolder(currentWorkspace.driveFolder);
          }
        }

        // Always refresh file tree to ensure it reflects the current workspace
        await refreshFileTree();
      } catch (error) {
        console.error('Error restoring workspace on mount:', error);
        // Try to refresh anyway to show something
        try {
          await refreshFileTree();
        } catch (refreshError) {
          console.error('Failed to refresh file tree on mount:', refreshError);
        }
      }
    };

    restoreOnLoad();
  }, []); // Run only once on mount

  // Listen for new workspace modal trigger
  React.useEffect(() => {
    const handleOpenModal = () => {
      setIsTypePickerOpen(true);
    };

    document.addEventListener('openNewWorkspaceModal', handleOpenModal);
    return () => document.removeEventListener('openNewWorkspaceModal', handleOpenModal);
  }, []);

  const handleTypeSelected = (type: Workspace['type']) => {
    setSelectedWorkspaceType(type);
    setIsCreateDialogOpen(true);
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error("Please enter a workspace name");
      return;
    }

    // Check for duplicate workspace names
    const duplicateWorkspace = workspaces.find(
      w => w.name.toLowerCase() === newWorkspaceName.trim().toLowerCase()
    );
    if (duplicateWorkspace) {
      toast.error(`A workspace named "${newWorkspaceName}" already exists. Please choose a different name.`);
      return;
    }

    try {
      if (selectedWorkspaceType === WorkspaceType.Local) {
        // For local workspace, open directory picker first and create workspace using same id
        const newWorkspaceId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await openLocalDirectory(newWorkspaceId);
        // Create workspace with the selected directory using the same id so stored directory handle matches
        createWorkspace(newWorkspaceName, WorkspaceType.Local, { id: newWorkspaceId });
        toast.success("Local workspace created successfully!");
      } else if (selectedWorkspaceType === WorkspaceType.Drive) {
        // For Google Drive workspace, authenticate and create folder
        try {
          const token = await requestDriveAccessToken(true);
          if (!token) {
            toast.error("Failed to authenticate with Google Drive");
            return;
          }

          // Create a folder in Google Drive for this workspace
          const metadata = {
            name: `Verve - ${newWorkspaceName}`,
            mimeType: 'application/vnd.google-apps.folder'
          };

          const response = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
          });

          if (!response.ok) {
            throw new Error('Failed to create Google Drive folder');
          }

          const folder = await response.json();

          // Create workspace with the Google Drive folder ID
          createWorkspace(newWorkspaceName, WorkspaceType.Drive, { driveFolder: folder.id });

          // Set the folder in file explorer
          if (setGoogleFolder) {
            setGoogleFolder(folder.id);
          }
          // Refresh file tree so the newly created (empty) Drive workspace is shown
          try {
            await refreshFileTree();
          } catch (e) {
            console.warn('Failed to refresh file tree after creating Drive workspace', e);
          }

          // Create default verve.md file in the Drive folder
          try {
            const fileMetadata = {
              name: 'verve.md',
              parents: [folder.id],
              mimeType: 'text/markdown'
            };
            const fileContent = '# Verve';
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
            form.append('file', new Blob([fileContent], { type: 'text/markdown' }));

            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: form
            });

            // Refresh file tree to show the new file
            try {
              await refreshFileTree();
            } catch (e) {
              console.warn('Failed to refresh file tree after creating default file', e);
            }

            // Pre-cache files - they're already in RxDB so no need for explicit pre-caching
          } catch (err) {
            console.warn('Failed to create default verve.md file:', err);
          }

          toast.success("Google Drive workspace created successfully!");
        } catch (error) {
          console.error('Error creating Google Drive workspace:', error);
          toast.error("Failed to create Google Drive workspace", (error as Error).message);
          return;
        }
      } else {
        // Browser workspace
        const workspaceId = `${WorkspaceType.Browser}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        createWorkspace(newWorkspaceName, WorkspaceType.Browser, { id: workspaceId });

        // Default file creation handled by workspace store for browser workspaces
        // Refresh file tree so the new file appears when ready
        try {
          await refreshFileTree();
        } catch (e) {
          console.warn('Failed to refresh file tree after creating workspace', e);
        }
        toast.success("Browser workspace created successfully!");
      }
      
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      setSelectedWorkspaceType(WorkspaceType.Browser);
    } catch (error) {
      toast.error("Failed to create workspace", (error as Error).message);
    }
  };

  const handleSwitchWorkspace = async (workspace: Workspace) => {
    // Prevent switching if already in progress
    if (isSwitching) {
      return;
    }

    // Don't switch if already active
    if (workspace.id === currentWorkspace?.id) {
      return;
    }

    setIsSwitching(true);

    // Wrap the entire switching flow with runWithLoading so the global AppLoader
    // remains visible until refresh and pre-caching complete.
    await runWithLoading(async () => {
      try {
        // Clear selection immediately so it doesn't point to a file from the previous workspace
        setSelectedFile(null);

        // Always clear local directory handle before switching workspaces
        // This ensures we start fresh with the new workspace
        clearLocalDirectory();

        // Switch the active workspace in the store first (this will reload tabs with fresh content)
        await switchWorkspace(workspace.id);

        // If switching to a local workspace, try to restore the directory handle
        if (workspace.type === WorkspaceType.Local) {
          const restored = await restoreLocalDirectory(workspace.id);
          if (!restored) {
            // Try prompting the user (this is a user-initiated click) to re-grant permission
            try {
              const granted = await requestPermissionForWorkspace(workspace.id);
              if (!granted) {
                toast.error("Failed to restore local directory. Please select the directory again.");
              }
            } catch (err) {
              console.error('Permission prompt failed:', err);
              toast.error("Failed to restore local directory. Please select the directory again.");
            }
            // Still continue with workspace switch, refresh will show empty tree if not granted
          }
        } else if (workspace.type === WorkspaceType.Drive && workspace.driveFolder) {
          // Try to obtain a non-interactive Drive token so switching doesn't require re-auth
          try {
            await requestDriveAccessToken(false);
          } catch (err) {
            // Non-interactive token request may fail if no prior grant exists; ignore here
            console.warn('Non-interactive Drive token request failed (no prior grant?):', err);
          }

          // Set the Google Drive folder for this workspace
          if (setGoogleFolder) {
            setGoogleFolder(workspace.driveFolder);
          }
        }

        // Refresh file tree for the newly active workspace
        await refreshFileTree();

        // Files are already in RxDB cache, no need for explicit pre-caching

        toast.success(`Switched to "${workspace.name}"`);
      } catch (e) {
        console.error('Failed to switch workspace:', e);
        toast.error("Failed to switch workspace");
      }
    });

    setIsSwitching(false);
  };

  const handleDeleteClick = (workspace: Workspace) => {
    setWorkspaceToDelete(workspace);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!workspaceToDelete) return;

    // Prevent deletion of Verve Samples workspace
    if (workspaceToDelete.id === 'verve-samples') {
      toast.error("Cannot delete the Verve Samples workspace");
      setIsDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
      return;
    }

    if (workspaces.length <= 1) {
      toast.error("Cannot delete the last workspace");
      setIsDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
      return;
    }
    
    // Remove directory handle from IndexedDB if it's a local workspace
    if (workspaceToDelete.type === WorkspaceType.Local) {
      import('@/shared/utils/idb-storage').then(({ removeDirectoryHandle }) => {
        removeDirectoryHandle(workspaceToDelete.id).catch((error) => {
          console.error('Failed to remove directory handle:', error);
        });
      });
    }

    deleteWorkspace(workspaceToDelete.id);

    // Refresh file tree to reflect the active workspace
    try {
      await refreshFileTree();
    } catch (e) {
      console.warn('Failed to refresh file tree after deleting workspace', e);
    }

    toast.success(`Workspace "${workspaceToDelete.name}" deleted`);
    setIsDeleteDialogOpen(false);
    setWorkspaceToDelete(null);
  };

  const getWorkspaceIcon = (type: Workspace['type']) => {
    switch (type) {
      case WorkspaceType.Local:
        return <FolderOpen className="h-3 w-3" />;
      case WorkspaceType.Drive:
        return <Cloud className="h-3 w-3" />;
      default:
        return <Globe className="h-3 w-3" />;
    }
  };

  const getWorkspaceTypeLabel = (type: Workspace['type']) => {
    switch (type) {
      case WorkspaceType.Local:
        return 'Local Files';
      case WorkspaceType.Drive:
        return 'Google Drive';
      default:
        return 'Browser Storage';
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <DropdownMenu open={isWorkspacePickerOpen} onOpenChange={setWorkspacePickerOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between text-left font-normal h-8 px-2"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {currentWorkspace && getWorkspaceIcon(currentWorkspace.type)}
              <span className="truncate flex items-center gap-2">
                {currentWorkspace?.name || "No workspace selected"}
                {currentWorkspace?.type === WorkspaceType.Drive && (isSyncingDrive || pendingSyncCount > 0) && (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    {pendingSyncCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {pendingSyncCount}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-64">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="flex items-center group">
              <DropdownMenuItem
                onClick={() => handleSwitchWorkspace(workspace)}
                disabled={isSwitching}
                className={cn(
                  "cursor-pointer flex-1 flex items-center gap-2",
                  workspace.id === currentWorkspace?.id && "bg-accent",
                  isSwitching && "opacity-50 cursor-not-allowed"
                )}
              >
                {getWorkspaceIcon(workspace.type)}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate">{workspace.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {getWorkspaceTypeLabel(workspace.type)}
                  </span>
                </div>
              </DropdownMenuItem>
              {workspaces.length > 1 && workspace.id !== 'verve-samples' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity mr-1"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="right">
                    <DropdownMenuItem 
                      onClick={() => handleDeleteClick(workspace)}
                      className="text-destructive cursor-pointer"
                    >
                      <Trash className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {workspaces.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem 
            onClick={() => setIsTypePickerOpen(true)} 
            disabled={isSwitching}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Create {selectedWorkspaceType === WorkspaceType.Browser ? 'Browser' : selectedWorkspaceType === WorkspaceType.Local ? 'Local' : 'Google Drive'} Workspace
            </DialogTitle>
            <DialogDescription>
              Give your {selectedWorkspaceType === WorkspaceType.Browser ? 'browser' : selectedWorkspaceType === WorkspaceType.Local ? 'local' : 'Google Drive'} workspace a name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder={`My ${selectedWorkspaceType === WorkspaceType.Browser ? 'Browser' : selectedWorkspaceType === WorkspaceType.Local ? 'Local' : 'Drive'} Workspace`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateWorkspace();
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedWorkspaceType === WorkspaceType.Browser
                ? 'Your workspace will be saved in browser storage and available on this device.'
                : selectedWorkspaceType === WorkspaceType.Local
                  ? 'Your workspace will connect to a folder on your computer for file access.'
                  : 'Your workspace will sync files with a Google Drive folder.'
              }
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsTypePickerOpen(true);
              }}
            >
              Back
            </Button>
            <Button onClick={handleCreateWorkspace}>
              Create Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Workspace
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{workspaceToDelete?.name}"?
              {workspaceToDelete?.type === WorkspaceType.Browser && (
                <span className="block mt-2 text-destructive">
                  Warning: All files in this workspace will be permanently deleted from browser storage.
                </span>
              )}
              {workspaceToDelete?.type === WorkspaceType.Local && (
                <span className="block mt-2">
                  Note: Your local files will not be deleted, only the workspace connection will be removed.
                </span>
              )}
              {workspaceToDelete?.type === WorkspaceType.Drive && (
                <span className="block mt-2">
                  Note: Your Google Drive files will not be deleted, only the workspace connection will be removed.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setWorkspaceToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workspace Type Picker */}
      <WorkspaceTypePicker
        open={isTypePickerOpen}
        onOpenChange={setIsTypePickerOpen}
        onSelectType={handleTypeSelected}
      />
    </div>
  );
}
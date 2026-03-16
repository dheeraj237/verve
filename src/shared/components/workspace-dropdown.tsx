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
  AlertTriangle,
  Lock
} from "lucide-react";
import { useWorkspaceStore, Workspace } from "@/core/store/workspace-store";
import { WorkspaceType } from '@/core/cache/types';
import { runWithLoading } from '@/core/loading/run-with-loading';
import { useFileExplorerStore } from "@/features/file-explorer/store/file-explorer-store";
import { cn } from "@/shared/utils/cn";
import { toast } from "@/shared/utils/toast";
import { WorkspaceTypePicker } from "@/shared/components/workspace-type-picker";
import {
  isFileSystemAccessSupported,
  pickDirectory,
  hasPermission,
  verifyPermission
} from '@/core/sync/directory-picker';
import {
  getHandle,
  setHandle,
  removeHandle
} from '@/core/sync/handle-store';
import { getSyncManager } from '@/core/sync/sync-manager';
// UI uses RxDB cache only; do not call external adapters or auth flows here

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
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [workspaceNeedingPermission, setWorkspaceNeedingPermission] = useState<Workspace | null>(null);
  const [pendingDirectoryHandle, setPendingDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  
  const { 
    workspaces, 
    activeWorkspace, 
    isWorkspacePickerOpen, 
    setWorkspacePickerOpen,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace
  } = useWorkspaceStore();

  const { openLocalDirectory, setGoogleFolder, setSelectedFile, refreshFileTree, clearLocalDirectory, isSyncingDrive, pendingSyncCount } = useFileExplorerStore();

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
        // Refresh file tree from RxDB cache (UI no longer uses direct adapter access)
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

  /**
   * Check if a local workspace has the required permission.
   * Safe to call without user gesture.
   */
  const checkLocalWorkspacePermission = async (workspaceId: string): Promise<boolean> => {
    try {
      const handle = await getHandle(workspaceId);
      if (!handle) {
        console.warn('No stored handle for workspace:', workspaceId);
        return false;
      }

      // Check permission (no user gesture needed)
      const granted = await hasPermission(handle, true);
      return granted;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  };

  /**
   * Request permission for a local workspace.
   * MUST be called from a user gesture (button click).
   */
  const requestLocalWorkspacePermission = async (workspaceId: string): Promise<boolean> => {
    try {
      const handle = await getHandle(workspaceId);
      if (!handle) {
        toast.error('Directory handle not found', 'Please recreate the workspace');
        return false;
      }

      // Request permission (requires user gesture)
      const granted = await verifyPermission(handle, true);
      if (!granted) {
        toast.error('Permission denied', 'Unable to access the directory');
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request permission', error?.message || 'Unknown error');
      return false;
    }
  };

  /**
   * Mount a local workspace after permissions are verified.
   */
  const mountLocalWorkspace = async (workspaceId: string): Promise<void> => {
    try {
      await getSyncManager().mountWorkspace(workspaceId, 'local');
      await refreshFileTree();
    } catch (error: any) {
      console.error('Error mounting local workspace:', error);
      throw error;
    }
  };

  /**
   * Handle workspace type selection from the type picker.
   * For local workspaces, immediately call directory picker to preserve user gesture.
   */
  const handleTypeSelected = async (type: Workspace['type']) => {
    setSelectedWorkspaceType(type);

    // For local workspaces, call directory picker IMMEDIATELY while user gesture is fresh
    if (type === WorkspaceType.Local) {
      // Check API support first (synchronous)
      if (!isFileSystemAccessSupported()) {
        toast.error(
          'File System Access API not supported',
          'Please use a modern browser like Chrome 86+, Edge 86+, or Safari 15.2+'
        );
        return;
      }

      try {
        // CRITICAL: Call pickDirectory() immediately from user gesture
        const directoryHandle = await pickDirectory();

        if (!directoryHandle) {
          // User cancelled - don't show name dialog
          toast.info('Directory selection was cancelled');
          return;
        }

        // Verify permission while still in user gesture context
        const granted = await verifyPermission(directoryHandle, true);
        if (!granted) {
          toast.error('Permission denied', 'Unable to read/write to the selected directory');
          return;
        }

        // Store handle temporarily and show name input dialog
        setPendingDirectoryHandle(directoryHandle);
        setIsCreateDialogOpen(true);
      } catch (err: any) {
        console.error('Directory picker error:', err);
        toast.error('Failed to open directory picker', err?.message || 'Unknown error');
      }
    } else {
      // For non-local workspaces, just show the name dialog
      setPendingDirectoryHandle(null);
      setIsCreateDialogOpen(true);
    }
  };

  const handleCreateWorkspace = async () => {
    // Validate workspace name first
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
        // For local workspaces, we should already have a directory handle from handleTypeSelected
        if (!pendingDirectoryHandle) {
          toast.error('No directory selected', 'Please try again');
          return;
        }

        const directoryHandle = pendingDirectoryHandle;
        const newWorkspaceId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tempWorkspaceName = newWorkspaceName.trim();

        // Close dialog and clear state
        setIsCreateDialogOpen(false);
        setNewWorkspaceName("");
        setSelectedWorkspaceType(WorkspaceType.Browser);
        setPendingDirectoryHandle(null);

        // Create and mount workspace
        await runWithLoading(async () => {
          try {
            // Save handle to IndexedDB
            await setHandle(newWorkspaceId, directoryHandle);

            // Create workspace entry in store
            createWorkspace(tempWorkspaceName, WorkspaceType.Local, { id: newWorkspaceId });

            // Mount workspace and load files
            await mountLocalWorkspace(newWorkspaceId);

            toast.success(`Local workspace "${tempWorkspaceName}" created successfully!`);
          } catch (error: any) {
            // Error occurred - clean up
            try {
              await removeHandle(newWorkspaceId);
              deleteWorkspace(newWorkspaceId);
            } catch (cleanupError) {
              console.error('Failed to clean up after error:', cleanupError);
            }
            toast.error('Failed to load directory', error?.message || 'Unknown error');
          }
        });

        return; // dialog already dismissed above — skip the shared close below
      } else if (selectedWorkspaceType === WorkspaceType.GDrive) {
        // Create a Drive workspace entry — do not call Google APIs from UI
        createWorkspace(newWorkspaceName, WorkspaceType.GDrive, {});
        toast.success("Drive workspace created (cache-only)");
        // Refresh file tree to show empty state
        try {
          await refreshFileTree();
        } catch (e) {
          console.warn('Failed to refresh file tree after creating GDrive workspace', e);
        }
      } else {
        // Browser workspace
        const workspaceId = `${WorkspaceType.Browser}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        createWorkspace(newWorkspaceName, WorkspaceType.Browser, { id: workspaceId });
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
    // remains visible until refresh completes.
    await runWithLoading(async () => {
      try {
        // Clear selection immediately so it doesn't point to a file from the previous workspace
        setSelectedFile(null);

        // For local workspaces, check permission first
        if (workspace.type === WorkspaceType.Local) {
          const hasPermissionGranted = await checkLocalWorkspacePermission(workspace.id);

          if (!hasPermissionGranted) {
            // Permission needed - show dialog to request it
            setWorkspaceNeedingPermission(workspace);
            setIsPermissionDialogOpen(true);
            setIsSwitching(false);
            return;
          }

          // Permission granted - switch and mount
          await switchWorkspace(workspace.id);
          await mountLocalWorkspace(workspace.id);
        } else {
          // Browser or GDrive workspace - just switch
          await switchWorkspace(workspace.id);
          await refreshFileTree();
        }

        toast.success(`Switched to "${workspace.name}"`);
      } catch (e) {
        console.error('Failed to switch workspace:', e);
        toast.error("Failed to switch workspace");
      }
    });

    setIsSwitching(false);
  };

  /**
   * Handle permission grant request from the permission dialog.
   * MUST be called from a user gesture (button click).
   */
  const handleGrantPermission = async () => {
    if (!workspaceNeedingPermission) return;

    try {
      const granted = await requestLocalWorkspacePermission(workspaceNeedingPermission.id);

      if (granted) {
        // Permission granted - close dialog and switch workspace
        setIsPermissionDialogOpen(false);
        setWorkspaceNeedingPermission(null);

        await runWithLoading(async () => {
          await switchWorkspace(workspaceNeedingPermission.id);
          await mountLocalWorkspace(workspaceNeedingPermission.id);
          toast.success(`Switched to "${workspaceNeedingPermission.name}"`);
        });
      }
    } catch (error: any) {
      console.error('Error granting permission:', error);
      toast.error('Failed to grant permission', error?.message || 'Unknown error');
    }
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

    try {
      // For local workspaces, clean up the stored handle
      if (workspaceToDelete.type === WorkspaceType.Local) {
        try {
          await removeHandle(workspaceToDelete.id);
        } catch (error) {
          console.error('Failed to remove handle:', error);
          // Continue with deletion even if handle removal fails
        }
      }

      // Delete workspace entry; do not remove external storage from UI code
      deleteWorkspace(workspaceToDelete.id);

      // Refresh file tree to reflect the active workspace
      try {
        await refreshFileTree();
      } catch (e) {
        console.warn('Failed to refresh file tree after deleting workspace', e);
      }

      toast.success(`Workspace "${workspaceToDelete.name}" deleted`);
    } catch (error: any) {
      toast.error('Failed to delete workspace', error?.message || 'Unknown error');
    } finally {
      setIsDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    }
  };

  const getWorkspaceIcon = (type: Workspace['type']) => {
    switch (type) {
      case WorkspaceType.Local:
        return <FolderOpen className="h-3 w-3" />;
      case WorkspaceType.GDrive:
        return <Cloud className="h-3 w-3" />;
      default:
        return <Globe className="h-3 w-3" />;
    }
  };

  const getWorkspaceTypeLabel = (type: Workspace['type']) => {
    switch (type) {
      case WorkspaceType.Local:
        return 'Local Files';
      case WorkspaceType.GDrive:
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
                {currentWorkspace?.type === WorkspaceType.GDrive && (isSyncingDrive || pendingSyncCount > 0) && (
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
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            // Clear state when dialog closes
            setPendingDirectoryHandle(null);
            setNewWorkspaceName("");
          }
        }}
      >
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
                    e.preventDefault();
                    handleCreateWorkspace();
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedWorkspaceType === WorkspaceType.Browser
                ? 'Your workspace will be saved in browser storage and available on this device.'
                : selectedWorkspaceType === WorkspaceType.Local
                  ? `Directory selected: ${pendingDirectoryHandle?.name || 'Unknown'}. Enter a name for this workspace.`
                  : 'Your workspace will be created as a Drive workspace (UI uses RxDB cache only; direct Google Drive sync is disabled).'
              }
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateDialogOpen(false);
                setPendingDirectoryHandle(null);
                setNewWorkspaceName("");
                setIsTypePickerOpen(true);
              }}
              type="button"
            >
              Back
            </Button>
            <Button 
              onClick={handleCreateWorkspace}
              type="button"
            >
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
              {workspaceToDelete?.type === WorkspaceType.GDrive && (
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

      {/* Permission Request Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-yellow-500" />
              Permission Required
            </DialogTitle>
            <DialogDescription>
              {workspaceNeedingPermission && (
                <>
                  <span className="block">
                    The workspace "{workspaceNeedingPermission.name}" needs permission to access its directory.
                  </span>
                  <span className="block mt-2 text-sm">
                    Click "Grant Permission" below to allow Verve to read and write files in this directory.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPermissionDialogOpen(false);
                setWorkspaceNeedingPermission(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleGrantPermission}>
              Grant Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
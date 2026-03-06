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
        // Create a local workspace entry — UI does not perform filesystem access
        const newWorkspaceId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        createWorkspace(newWorkspaceName, WorkspaceType.Local, { id: newWorkspaceId });
        toast.success("Local workspace created (cache-only)");
        try {
          // Prompt user to select a local directory when the platform supports it
          await openLocalDirectory(newWorkspaceId);
          toast.success("Directory selected and scanned successfully");
        } catch (err) {
          // Directory picker failed or wasn't supported — show empty workspace and guide user
          console.warn('[Workspace] Directory picker failed:', err);
          toast.error("Directory picker not available. Use the Search bar to open a folder.");
        } finally {
          // Refresh file tree regardless of openLocalDirectory success/failure
          // This shows the file explorer with either scanned files or empty state
          try {
            await refreshFileTree();
          } catch (e) {
            console.warn('Failed to refresh file tree after creating local workspace', e);
          }
        }
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
        // Switch the active workspace in the store
        await switchWorkspace(workspace.id);

        // Refresh file tree for the newly active workspace from RxDB cache
        await refreshFileTree();

        // For Local workspaces, check if directory handle is ready
        // If not ready, prompt user to grant permission or pick directory
        if (workspace.type === WorkspaceType.Local) {
          try {
            const sm = (await import('@/core/sync/sync-manager')).getSyncManager();
            const readiness = sm.getLocalAdapterReadinessForWorkspace(workspace.id);

            if (!readiness.isReady && readiness.needsUserGesture) {
              // Adapter is not ready - show modal to prompt for directory access
              console.log('[WorkspaceDropdown] Local adapter not ready, showing permission prompt...');

              let userActionCompleted = false;

              // Show toast with action button
              const actionToast = toast.custom(
                <div className="space-y-2">
                  <div className="text-sm font-medium">Directory Access Required</div>
                  <div className="text-sm">This local workspace needs to access your file system to sync files.</div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={async () => {
                        if (userActionCompleted) return;
                        try {
                          // Try to restore from existing stored handle first (requires user gesture)
                          console.log('[WorkspaceDropdown] Attempting to restore from stored handle...');
                          const restored = await restoreLocalDirectory(workspace.id);
                          if (restored) {
                            // Files were loaded, refresh tree
                            await refreshFileTree();
                            userActionCompleted = true;
                            actionToast.dismiss();
                            toast.success('Directory access restored successfully');
                          } else {
                            // No stored handle, need to open directory picker
                            console.log('[WorkspaceDropdown] No stored handle, opening directory picker...');
                            await openLocalDirectory(workspace.id);
                            await refreshFileTree();
                            userActionCompleted = true;
                            actionToast.dismiss();
                            toast.success('Directory selected and scanned successfully');
                          }
                        } catch (err) {
                          console.error('[WorkspaceDropdown] Error in grant access flow:', err);
                          toast.error('Failed to access directory. Please try again.');
                        }
                      }}
                    >
                      Grant Access
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        actionToast.dismiss();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>,
                {
                  duration: 0, // Don't auto-dismiss
                }
              );

              return; // Exit early - await user action through toast
            }
          } catch (err) {
            console.warn('[WorkspaceDropdown] Failed to check Local adapter readiness:', err);
            // Continue anyway - adapter might become ready later
          }

          toast.info('Local workspace opened (cache-only). Direct filesystem access is disabled in the UI.');
        } else if (workspace.type === WorkspaceType.GDrive) {
          toast.info('Drive workspace opened (cache-only). Direct Google Drive sync is disabled in the UI.');
        }

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
    
    // Delete workspace entry; do not remove external storage from UI code
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
                  ? 'Your workspace will be created as a local workspace (UI uses RxDB cache only; direct local filesystem access is disabled).'
                  : 'Your workspace will be created as a Drive workspace (UI uses RxDB cache only; direct Google Drive sync is disabled).'
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
    </div>
  );
}
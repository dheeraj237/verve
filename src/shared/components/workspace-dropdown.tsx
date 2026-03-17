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
  Lock,
  Loader2
} from "lucide-react";
import { useWorkspaceStore, Workspace } from "@/core/store/workspace-store";
import { WorkspaceType } from '@/core/cache/types';
import { runWithLoading } from '@/core/loading/run-with-loading';
import { useFileExplorerStore } from "@/features/file-explorer/store/file-explorer-store";
import { useUserStore } from "@/core/store/user-store";
import { cn } from "@/shared/utils/cn";
import { toast } from "@/shared/utils/toast";
import {
  hasPermission,
  requestPermission
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [selectedWorkspaceType, setSelectedWorkspaceType] = useState<Workspace['type']>(WorkspaceType.Browser);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [workspaceNeedingPermission, setWorkspaceNeedingPermission] = useState<Workspace | null>(null);
  const [workspaceHandleForPermission, setWorkspaceHandleForPermission] = useState<FileSystemDirectoryHandle | null>(null);
  const [pendingDirectoryHandle, setPendingDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);

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
      setIsCreateDialogOpen(true);
    };

    document.addEventListener('openNewWorkspaceModal', handleOpenModal);
    return () => document.removeEventListener('openNewWorkspaceModal', handleOpenModal);
  }, []);

  /**
   * Handle directory picker for local workspaces.
   * MUST be called from a user gesture (button click).
   * 
   * CRITICAL: Calls window.showDirectoryPicker() directly inline to ensure
   * the API is invoked immediately within the user gesture context without
   * any function call abstraction that could break the gesture association.
   */
  const handlePickDirectory = () => {
    // Check API support first (synchronous)
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      toast.error(
        'File System Access API not supported',
        'Please use a modern browser like Chrome 86+, Edge 86+, or Safari 15.2+'
      );
      return;
    }

    // CRITICAL: Call window.showDirectoryPicker() DIRECTLY without any wrapper
    // This must be the first async operation in the call stack to preserve user gesture
    const pickerPromise = (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });

    // Handle the promise result asynchronously
    pickerPromise
      .then(async (directoryHandle: FileSystemDirectoryHandle) => {
        if (!directoryHandle) {
          // User cancelled
          toast.info('Directory selection was cancelled');
          return;
        }

        // Check if we already have permission
        let hasPermissionGranted = false;
        try {
          const permissionStatus = await (directoryHandle as any).queryPermission({ mode: 'readwrite' });
          hasPermissionGranted = permissionStatus === 'granted';
        } catch (e) {
          console.warn('Failed to query permission:', e);
        }

        // Request permission if needed
        if (!hasPermissionGranted) {
          try {
            const permissionStatus = await (directoryHandle as any).requestPermission({ mode: 'readwrite' });
            hasPermissionGranted = permissionStatus === 'granted';
          } catch (e) {
            console.error('Failed to request permission:', e);
          }
        }

        if (!hasPermissionGranted) {
          toast.error('Permission denied', 'Unable to read/write to the selected directory');
          setPendingDirectoryHandle(null);
          return;
        }

        // Store handle temporarily
        setPendingDirectoryHandle(directoryHandle);
        toast.success(`Selected directory: ${directoryHandle.name}`);
      })
      .catch((err: any) => {
        // User cancelled
        if (err?.name === 'AbortError') {
          toast.info('Directory selection was cancelled');
          return;
        }
        console.error('Directory picker error:', err);
        toast.error('Failed to open directory picker', err?.message || 'Unknown error');
        setPendingDirectoryHandle(null);
      });
  };

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
   * Handle workspace creation form submission
   */
  const handleCreateWorkspace = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate workspace name
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

    // For local workspaces, verify directory is selected
    if (selectedWorkspaceType === WorkspaceType.Local && !pendingDirectoryHandle) {
      toast.error('Please select a directory', 'Click "Select Directory" to choose a folder');
      return;
    }

    setIsCreating(true);

    try {
      if (selectedWorkspaceType === WorkspaceType.Local) {
        const directoryHandle = pendingDirectoryHandle!;
        const newWorkspaceId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tempWorkspaceName = newWorkspaceName.trim();

        // Close dialog and clear state
        setIsCreateDialogOpen(false);
        setNewWorkspaceName("");
        setSelectedWorkspaceType(WorkspaceType.Browser);
        setPendingDirectoryHandle(null);

        // Create and mount workspace with loading
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
      } else if (selectedWorkspaceType === WorkspaceType.GDrive) {
        const tempWorkspaceName = newWorkspaceName.trim();

        // Close dialog and clear state
        setIsCreateDialogOpen(false);
        setNewWorkspaceName("");
        setSelectedWorkspaceType(WorkspaceType.Browser);

        // Create workspace with loading
        await runWithLoading(async () => {
          createWorkspace(tempWorkspaceName, WorkspaceType.GDrive, {});
          await refreshFileTree();
          toast.success(`Drive workspace "${tempWorkspaceName}" created successfully!`);
        });
      } else {
        // Browser workspace
        const workspaceId = `${WorkspaceType.Browser}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tempWorkspaceName = newWorkspaceName.trim();

        // Close dialog and clear state
        setIsCreateDialogOpen(false);
        setNewWorkspaceName("");
        setSelectedWorkspaceType(WorkspaceType.Browser);

        // Create workspace with loading
        await runWithLoading(async () => {
          createWorkspace(tempWorkspaceName, WorkspaceType.Browser, { id: workspaceId });
          await refreshFileTree();
          toast.success(`Browser workspace "${tempWorkspaceName}" created successfully!`);
        });
      }
    } catch (error: any) {
      console.error('Failed to create workspace:', error);
      toast.error("Failed to create workspace", error?.message || 'Unknown error');
    } finally {
      setIsCreating(false);
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
            // Permission needed - fetch handle and show dialog to request it
            try {
              const handle = await getHandle(workspace.id);
              if (!handle) {
                toast.error('Directory handle not found', 'Please recreate the workspace');
                setIsSwitching(false);
                return;
              }

              setWorkspaceNeedingPermission(workspace);
              setWorkspaceHandleForPermission(handle);
              setIsPermissionDialogOpen(true);
              setIsSwitching(false);
              return;
            } catch (error: any) {
              console.error('Error fetching handle for permission:', error);
              toast.error('Failed to access workspace', error?.message || 'Unknown error');
              setIsSwitching(false);
              return;
            }
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
   * 
   * CRITICAL: Calls handle.requestPermission() directly inline to ensure
   * the API is invoked immediately within the user gesture context.
   */
  const handleGrantPermission = () => {
    if (!workspaceNeedingPermission || !workspaceHandleForPermission) return;

    const workspace = workspaceNeedingPermission;
    const handle = workspaceHandleForPermission;

    // CRITICAL: Call handle.requestPermission() DIRECTLY without any wrapper
    const permissionPromise = (handle as any).requestPermission({ mode: 'readwrite' });

    // Handle the promise result asynchronously
    permissionPromise
      .then(async (permissionStatus: string) => {
        const granted = permissionStatus === 'granted';
        
        if (granted) {
          // Permission granted - close dialog and switch workspace
          setIsPermissionDialogOpen(false);
          setWorkspaceNeedingPermission(null);
          setWorkspaceHandleForPermission(null);

          await runWithLoading(async () => {
            await switchWorkspace(workspace.id);
            await mountLocalWorkspace(workspace.id);
            toast.success(`Switched to "${workspace.name}"`);
          });
        } else {
          toast.error('Permission denied', 'Unable to access the directory');
        }
      })
      .catch((error: any) => {
        console.error('Error granting permission:', error);
        toast.error('Failed to grant permission', error?.message || 'Unknown error');
      });
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
            onClick={() => setIsCreateDialogOpen(true)} 
            disabled={isSwitching}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Dialog - Unified Form */}
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!isCreating) {
            setIsCreateDialogOpen(open);
            if (!open) {
              // Clear state when dialog closes
              setPendingDirectoryHandle(null);
              setNewWorkspaceName("");
              setSelectedWorkspaceType(WorkspaceType.Browser);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Enter a name for your workspace and select where you'd like to store it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWorkspace}>
            <div className="space-y-6 py-4">
              {/* Workspace Name Input */}
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name *</Label>
                <Input
                  id="workspace-name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="My Workspace"
                  disabled={isCreating}
                  autoFocus
                />
              </div>

              {/* Workspace Type Selection */}
              <div className="space-y-3">
                <Label>Storage Type *</Label>
                <div className="space-y-2">
                  {/* Browser option */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkspaceType(WorkspaceType.Browser);
                      setPendingDirectoryHandle(null);
                    }}
                    disabled={isCreating}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border-2 transition-colors",
                      "hover:border-primary/50 focus:outline-none focus:border-primary",
                      selectedWorkspaceType === WorkspaceType.Browser
                        ? "border-primary bg-primary/5"
                        : "border-border",
                      isCreating && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        selectedWorkspaceType === WorkspaceType.Browser
                          ? "border-primary"
                          : "border-muted-foreground"
                      )}>
                        {selectedWorkspaceType === WorkspaceType.Browser && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <span className="font-medium">Browser Storage</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Saved locally in your browser
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Local File System option */}
                  <div
                    className={cn(
                      "w-full text-left p-4 rounded-lg border-2 transition-colors",
                      selectedWorkspaceType === WorkspaceType.Local
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                      isCreating && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setSelectedWorkspaceType(WorkspaceType.Local)}
                        disabled={isCreating}
                        className="w-full text-left focus:outline-none"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                            selectedWorkspaceType === WorkspaceType.Local
                              ? "border-primary"
                              : "border-muted-foreground"
                          )}>
                            {selectedWorkspaceType === WorkspaceType.Local && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4" />
                              <span className="font-medium">Local Directory</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {pendingDirectoryHandle
                                ? `Selected: ${pendingDirectoryHandle.name}`
                                : 'Connect to a folder on your computer'
                              }
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Directory picker button inside card */}
                      {selectedWorkspaceType === WorkspaceType.Local && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handlePickDirectory}
                          disabled={isCreating}
                          className="w-full"
                        >
                          <FolderOpen className="h-4 w-4 mr-2" />
                          {pendingDirectoryHandle ? 'Change Directory' : 'Select Directory'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Google Drive option */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isLoggedIn) {
                        setSelectedWorkspaceType(WorkspaceType.GDrive);
                        setPendingDirectoryHandle(null);
                      }
                    }}
                    disabled={!isLoggedIn || isCreating}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border-2 transition-colors",
                      "hover:border-primary/50 focus:outline-none focus:border-primary",
                      selectedWorkspaceType === WorkspaceType.GDrive
                        ? "border-primary bg-primary/5"
                        : "border-border",
                      (!isLoggedIn || isCreating) && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        selectedWorkspaceType === WorkspaceType.GDrive
                          ? "border-primary"
                          : "border-muted-foreground"
                      )}>
                        {selectedWorkspaceType === WorkspaceType.GDrive && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Cloud className="h-4 w-4" />
                          <span className="font-medium">Google Drive</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {isLoggedIn ? 'Sync with your Google Drive' : 'Sign in to enable Google Drive'}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                type="button"
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={
                  isCreating ||
                  !newWorkspaceName.trim() ||
                  (selectedWorkspaceType === WorkspaceType.Local && !pendingDirectoryHandle)
                }
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Workspace'
                )}
              </Button>
            </DialogFooter>
          </form>
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

      {/* Permission Request Dialog */}
      <Dialog
        open={isPermissionDialogOpen}
        onOpenChange={(open) => {
          setIsPermissionDialogOpen(open);
          if (!open) {
            // Clear state when dialog closes
            setWorkspaceNeedingPermission(null);
            setWorkspaceHandleForPermission(null);
          }
        }}
      >
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
                setWorkspaceHandleForPermission(null);
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
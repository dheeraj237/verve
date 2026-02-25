/**
 * Drive Sync Status Component
 * Shows sync status using RxDB dirty file tracking
 */

"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import { getDirtyFiles } from "@/core/cache/file-operations";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

export function DriveSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<QueueStatus>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    isProcessing: false,
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Poll dirty files every second to determine sync status
    const interval = setInterval(() => {
      try {
        const workspace = useWorkspaceStore.getState().activeWorkspace();
        if (workspace) {
          // Get dirty files from RxDB cache
          getDirtyFiles(workspace.id).then(dirtyFiles => {
            setSyncStatus({
              pending: dirtyFiles.length,
              processing: 0,
              completed: 0,
              failed: 0,
              isProcessing: dirtyFiles.length > 0
            });
          });
        } else {
          // No active workspace -> clear
          setSyncStatus({ pending: 0, processing: 0, completed: 0, failed: 0, isProcessing: false });
        }
      } catch (e) {
        // Ignore if cache not initialized yet

      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const pendingCount = syncStatus.pending + syncStatus.processing;
  const failedCount = syncStatus.failed;
  const isSyncing = syncStatus.isProcessing;

  if (pendingCount === 0 && failedCount === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span>Synced</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>All changes synced</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors",
              failedCount > 0
                ? "text-red-500 hover:text-red-600"
                : "text-blue-500 hover:text-blue-600"
            )}
          >
            {isSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : failedCount > 0 ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Cloud className="h-3 w-3" />
            )}
            <span>
              {isSyncing
                ? "Syncing..."
                : failedCount > 0
                ? `${failedCount} failed`
                : `${pendingCount} pending`}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Sync Status</p>
            {pendingCount > 0 && <p>{pendingCount} operations pending</p>}
            {failedCount > 0 && (
              <p className="text-red-500">{failedCount} operations failed</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-popover border rounded-md shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Sync Queue</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pending:</span>
              <span className="font-medium">{syncStatus.pending}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Processing:</span>
              <span className="font-medium">{syncStatus.processing}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Completed:</span>
              <span className="font-medium text-green-500">{syncStatus.completed}</span>
            </div>
            {syncStatus.failed > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Failed:</span>
                <span className="font-medium text-red-500">{syncStatus.failed}</span>
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            {isSyncing ? (
              <p className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Synchronizing changes...
              </p>
            ) : failedCount > 0 ? (
              <p className="text-red-500">Some operations failed. They will be retried automatically.</p>
            ) : pendingCount > 0 ? (
              <p>Changes will be synced automatically.</p>
            ) : (
              <p className="text-green-500">All changes are synced.</p>
            )}
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}

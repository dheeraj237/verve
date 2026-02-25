import { Button } from "@/shared/components/ui/button";
import { X, FileText, CircleDot } from "lucide-react";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { cn } from "@/shared/utils/cn";
import { isMarkdownFile } from "@/shared/utils/file-type-detector";
import { useEffect, useState } from 'react';
import { getCachedFile } from '@/core/cache';
import { useWorkspaceStore } from '@/core/store/workspace-store';

export function OpenedFilesSection() {
  const { openTabs, activeTabId, closeTab, openFile } = useEditorStore();
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace());
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const map: Record<string, boolean> = {};
      for (const tab of openTabs) {
        try {
          const cached = await getCachedFile(tab.path, activeWorkspace?.id);
          map[tab.id] = !!(cached && cached.dirty);
        } catch (e) {
          map[tab.id] = false;
        }
      }
      if (mounted) setDirtyMap(map);
    })();
    return () => { mounted = false; };
  }, [openTabs, activeWorkspace?.id]);

  const handleFileClick = (fileId: string) => {
    const file = openTabs.find(tab => tab.id === fileId);
    if (file) {
      openFile(file);
    }
  };

  const handleCloseFile = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    closeTab(fileId);
  };

  const getFileDisplayIcon = (filename: string) => {
    if (isMarkdownFile(filename)) {
      return <FileText className="h-3 w-3 text-blue-400" />;
    }
    return <FileText className="h-3 w-3" />;
  };

  if (openTabs.length === 0) {
    return (
      <div className="px-3 py-1.5">
        <div className="text-xs text-muted-foreground">
          No opened editors
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-1">
      <div className="space-y-0.5">
        {openTabs.map((file) => {
          const isActive = file.id === activeTabId;
          const isDirty = file.isSaving || false;
          
          return (
            <div
              key={file.id}
              className={cn(
                "group flex items-center gap-1.5 px-2 py-0.5 rounded-sm cursor-pointer hover:bg-sidebar-hover transition-colors text-xs",
                isActive && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleFileClick(file.id)}
              title={file.path}
            >
              {/* File icon */}
              <div className="shrink-0">
                {getFileDisplayIcon(file.name)}
              </div>

              {/* File name */}
              <span className="flex-1 truncate">
                {file.name}
              </span>

              {/* Dirty indicator or close button */}
              <div className="shrink-0 flex items-center gap-2">
                {isDirty || dirtyMap[file.id] ? (
                  <CircleDot className="h-3 w-3 text-amber-400" />
                ) : null}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleCloseFile(e, file.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
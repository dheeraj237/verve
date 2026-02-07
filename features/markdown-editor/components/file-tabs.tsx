"use client";

import { X, Loader2, Eye, Code2 } from "lucide-react";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

export function FileTabs() {
  const { openTabs, activeTabId, setActiveTab, closeTab, viewMode, isLivePreviewMode, setLivePreviewMode } = useEditorStore();

  if (openTabs.length === 0) return null;

  const formatLastSaved = (lastSaved?: Date) => {
    if (!lastSaved) return "Not saved yet";
    return `Last saved: ${lastSaved.toLocaleTimeString()}`;
  };

  const togglePreviewMode = () => {
    setLivePreviewMode(!isLivePreviewMode);
  };

  return (
    <TooltipProvider delayDuration={500}>
      <style jsx>{`
        .tab-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .tab-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .tab-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.2);
          border-radius: 3px;
        }
        .tab-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.3);
        }
      `}</style>
      <div className="flex items-center overflow-x-auto flex-1 flex-nowrap tab-scrollbar scale-90 origin-left overflow-y-hidden">
        {openTabs.map((tab) => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 border-r border-border cursor-pointer transition-all min-w-30 max-w-50 group relative shrink-0",
                  activeTabId === tab.id
                    ? "bg-editor-background text-foreground border-t-2 border-t-orange-500 shadow-sm"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border-t-2 border-t-transparent"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {activeTabId === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 shadow-sm" />
                )}
                <span className="text-sm truncate flex-1 font-medium">{tab.name}</span>
                {tab.isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                ) : (
                    <button
                      className={cn(
                        "bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded p-0.5 transition-all shrink-0",
                        activeTabId === tab.id
                          ? "opacity-70 hover:opacity-100"
                          : "opacity-0 group-hover:opacity-70 group-hover:hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      aria-label="Close tab"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8} className="text-xs max-w-xs">
              <div className="space-y-1">
                <div className="font-medium">{tab.path}</div>
                <div className="text-muted-foreground">{formatLastSaved(tab.lastSaved)}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {viewMode === "live" && openTabs.length > 0 && (
        <div className="flex items-center px-3 border-l border-border scale-90">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isLivePreviewMode ? "default" : "outline"}
                onClick={togglePreviewMode}
                className="h-7 w-7 p-0 cursor-pointer"
              >
                {isLivePreviewMode ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                    <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                {isLivePreviewMode ? "Switch to Source Mode" : "Switch to Live Preview"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </TooltipProvider>
  );
}

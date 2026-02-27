"use client";

import { X, Loader2, Eye, Code2, AlertTriangle } from "lucide-react";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { isMarkdownFile } from "@/shared/utils/file-type-detector";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

export function FileTabs() {
  const { openTabs, activeTabId, setActiveTab, closeTab, isSourceMode, setSourceMode, isCodeViewMode } = useEditorStore();
  const currentTab = openTabs.find(tab => tab.id === activeTabId);
  const isMarkdown = currentTab ? isMarkdownFile(currentTab.name) : false;

  if (openTabs.length === 0) return null;

  const formatLastSaved = (lastSaved?: Date) => {
    if (!lastSaved) return "Not saved yet";
    return `Last saved: ${lastSaved.toLocaleString()}`;
  };

  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex items-center overflow-x-auto flex-1 flex-nowrap overflow-y-hidden scale-90 origin-left tabs-scrollbar">
        {openTabs.map((tab) => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 border-r border-border cursor-pointer transition-all min-w-32 max-w-56 group relative shrink-0",
                  activeTabId === tab.id
                    ? "bg-editor-background text-foreground border-t-2 border-t-orange-500 shadow-sm"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border-t-2 border-t-transparent"
                )}
                onClick={() => setActiveTab(tab.id)}
                title={`${tab.path} - Last saved: ${formatLastSaved(tab.lastSaved)}`}
              >
                {activeTabId === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 shadow-sm" />
                )}
                <span className="text-sm truncate flex-1 font-medium">{tab.name}</span>
                {tab.isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                ) : (tab as any).saveError ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-red-600 dark:text-red-400 rounded p-0.5 transition-all shrink-0 cursor-default">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" asChild={false}>
                      <div className="text-xs max-w-xs">
                        <div className="font-medium">Sync error</div>
                          <div className="text-muted-foreground break-words">{(tab as any).saveError}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div
                    role="button"
                    tabIndex={-1}
                    className={cn(
                      "bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded p-0.5 transition-all shrink-0 cursor-pointer",
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
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8} className="text-xs max-w-xs" asChild={false}>
              <div className="space-y-1">
                <div className="font-medium">{tab.path}</div>
                <div className="text-muted-foreground">{formatLastSaved(tab.lastSaved)}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {openTabs.length > 0 && (
        <div className="flex items-center px-2 border-l border-border w-12 justify-center">
          {isMarkdown && !isCodeViewMode ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSourceMode(!isSourceMode)}
                  className={cn(
                    "h-8 w-8 cursor-pointer transition-all",
                    !isSourceMode && "bg-muted"
                  )}
                  title={isSourceMode ? "Switch to Live Preview" : "Switch to Source Code"}
                >
                  {isSourceMode ? (
                    <Code2 className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" asChild={false}>
                <p className="text-xs">
                  {isSourceMode ? (
                    <>
                      <span className="font-semibold">Source Mode</span> - Click to switch to Live Preview
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">Live Preview</span> - Click to switch to Source Code
                    </>
                  )}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="h-8 w-8" />
          )}
        </div>
      )}
    </TooltipProvider>
  );
}

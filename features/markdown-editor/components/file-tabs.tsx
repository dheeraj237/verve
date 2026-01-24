"use client";

import { X } from "lucide-react";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { cn } from "@/shared/utils/cn";

export function FileTabs() {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center overflow-x-auto flex-1">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer hover:bg-muted/50 transition-colors min-w-[120px] max-w-[200px] group",
            activeTabId === tab.id && "bg-background border-b-2 border-b-primary"
          )}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="text-sm truncate flex-1">{tab.name}</span>
          <button
            className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity *:cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

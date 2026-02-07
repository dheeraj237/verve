"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { usePanelStore } from "@/core/store/panel-store";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { Separator } from "@/shared/components/ui/separator";

export function AppToolbar() {
  const { toggleLeftPanel, toggleRightPanel } = usePanelStore();
  const { activeTabId, viewMode } = useEditorStore();

  const showTocToggle = activeTabId !== null && (viewMode === "preview" || viewMode === "live");

  return (
    <div className="h-12 border-b bg-background px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="cursor-pointer" onClick={toggleLeftPanel}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="text-sm font-medium text-muted-foreground" title="MarkDown Is All You Need">
          MDIAYN Editor
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showTocToggle && (
          <Button variant="ghost" size="icon" className="cursor-pointer" onClick={toggleRightPanel}>
            <PanelRight className="h-4 w-4" />
          </Button>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}

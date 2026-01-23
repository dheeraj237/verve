"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { ViewModeToggle } from "@/shared/components/view-mode-toggle";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { usePanelStore } from "@/core/store/panel-store";
import { Separator } from "@/shared/components/ui/separator";

export function AppToolbar() {
  const { viewMode, setViewMode } = useEditorStore();
  const { toggleLeftPanel, toggleRightPanel } = usePanelStore();

  return (
    <div className="h-12 border-b bg-background px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleLeftPanel}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="text-sm font-medium text-muted-foreground">
          MDNotes Viewer
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="icon" onClick={toggleRightPanel}>
          <PanelRight className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}

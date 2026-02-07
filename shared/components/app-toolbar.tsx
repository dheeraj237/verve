"use client";

import { PanelLeft, PanelRight, PanelLeftClose, PanelRightClose, Code2, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { usePanelStore } from "@/core/store/panel-store";
import { useEditorStore, useCurrentFile } from "@/features/editor/store/editor-store";
import { Separator } from "@/shared/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { isMarkdownFile } from "@/shared/utils/file-type-detector";
import { cn } from "@/shared/utils/cn";

export function AppToolbar() {
  const { toggleLeftPanel, toggleRightPanel, leftPanelCollapsed, rightPanelCollapsed } = usePanelStore();
  const { activeTabId, isCodeViewMode, setCodeViewMode } = useEditorStore();
  const currentFile = useCurrentFile();

  const hasActiveFile = activeTabId !== null;
  const isMarkdown = currentFile ? isMarkdownFile(currentFile.name) : false;

  return (
    <div className="h-12 border-b bg-background px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-muted-foreground" title="MarkDown Is All You Need">
          MDIAYN Editor
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Code/Live Switcher - only for markdown files */}
        {hasActiveFile && isMarkdown && (
          <>
            <Tabs value={isCodeViewMode ? "code" : "live"} onValueChange={(value) => setCodeViewMode(value === "code")}>
              <TabsList className="h-8">
                <TabsTrigger value="code" className="gap-1.5 cursor-pointer" title="Code Editor">
                  <Code2 className={cn("h-3.5 w-3.5", !isCodeViewMode && "text-muted-foreground")} />
                  <span className="text-xs">Code</span>
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-1.5 cursor-pointer" title="Live Preview Editor">
                  <Sparkles className={cn("h-3.5 w-3.5", isCodeViewMode && "text-muted-foreground")} />
                  <span className="text-xs">Live</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}

        {/* Panel toggles */}
        <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={toggleLeftPanel}>
          {leftPanelCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
              <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={toggleRightPanel}>
          {rightPanelCollapsed ? (
            <PanelRight className="h-4 w-4" />
          ) : (
              <PanelRightClose className="h-4 w-4" />
          )}
        </Button>

        <Separator orientation="vertical" className="h-6" />
        <ThemeToggle />
      </div>
    </div>
  );
}

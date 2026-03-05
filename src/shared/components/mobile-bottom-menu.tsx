/**
 * Mobile Bottom Navigation Menu
 * Provides panel toggles and home button for mobile devices
 * Replaces toolbar toggles on screens below lg breakpoint
 */
"use client";

import { Menu, List, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { usePanelStore } from "@/core/store/panel-store";
import { useEditorStore, useCurrentFile } from "@/features/editor/store/editor-store";
import { isMarkdownFile } from "@/shared/utils/file-type-detector";
import { cn } from "@/shared/utils/cn";

export function MobileBottomMenu() {
  const { toggleLeft, toggleRight, leftPanelOpen, rightPanelOpen } = usePanelStore();
  const { activeTabId, isCodeViewMode } = useEditorStore();
  const currentFile = useCurrentFile();
  const isMarkdown = currentFile ? isMarkdownFile(currentFile.name) : false;
  const showToc = activeTabId !== null && isMarkdown && !isCodeViewMode;
  const navigate = useNavigate();

  const handleHome = () => {
    // Navigate to home page
    navigate("/");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 border-t bg-background flex items-center justify-center gap-3 px-3 lg:hidden">
      {/* File Explorer Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="cursor-pointer h-10 w-10"
        onClick={toggleLeft}
        title={leftPanelOpen ? "Hide File Explorer" : "Show File Explorer"}
      >
        <Menu className={cn("h-5 w-5", leftPanelOpen === false && "opacity-50")} />
      </Button>

      {/* Table of Contents Toggle */}
      {showToc && (
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer h-10 w-10"
          onClick={toggleRight}
          title={rightPanelOpen ? "Hide Table of Contents" : "Show Table of Contents"}
        >
          <List className={cn("h-5 w-5", rightPanelOpen === false && "opacity-50")} />
        </Button>
      )}

      {/* Home Button */}
      <Separator orientation="vertical" className="h-6" />
      <Button
        variant="ghost"
        size="icon"
        className="cursor-pointer h-10 w-10"
        onClick={handleHome}
        title="Go Home"
      >
        <Home className="h-5 w-5" />
      </Button>
    </div>
  );
}

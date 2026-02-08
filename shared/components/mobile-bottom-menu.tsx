/**
 * Mobile Bottom Navigation Menu
 * Provides panel toggles and home button for mobile devices
 * Replaces toolbar toggles on screens below lg breakpoint
 */
"use client";

import { Menu, List, Home } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { usePanelStore } from "@/core/store/panel-store";
import { cn } from "@/shared/utils/cn";

export function MobileBottomMenu() {
  const { toggleLeftPanel, toggleRightPanel, leftPanelCollapsed, rightPanelCollapsed } =
    usePanelStore();

  const handleHome = () => {
    // Reload the app
    window.location.href = "/";
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 border-t bg-background flex items-center justify-center gap-3 px-3 lg:hidden">
      {/* File Explorer Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="cursor-pointer h-10 w-10"
        onClick={toggleLeftPanel}
        title={leftPanelCollapsed ? "Show File Explorer" : "Hide File Explorer"}
      >
        <Menu className={cn("h-5 w-5", leftPanelCollapsed === false && "opacity-50")} />
      </Button>

      {/* Table of Contents Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="cursor-pointer h-10 w-10"
        onClick={toggleRightPanel}
        title={rightPanelCollapsed ? "Show Table of Contents" : "Hide Table of Contents"}
      >
        <List className={cn("h-5 w-5", rightPanelCollapsed === false && "opacity-50")} />
      </Button>

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

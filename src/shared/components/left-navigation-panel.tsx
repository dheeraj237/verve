import { cn } from "@/shared/utils/cn";
import { FileExplorer } from "@/features/file-explorer/components/file-explorer";
import { WorkspaceDropdown } from "@/shared/components/workspace-dropdown";
import { OpenedFilesSection } from "@/shared/components/opened-files-section";
import { SearchBar } from "@/shared/components/search-bar";
import { CollapsibleSection } from "@/shared/components/collapsible-section";
import { Button } from "@/shared/components/ui/button";
import { XCircle } from "lucide-react";
import { useEditorStore } from "@/features/editor/store/editor-store";

interface LeftNavigationPanelProps {
  className?: string;
}

export function LeftNavigationPanel({ className }: LeftNavigationPanelProps) {
  const { closeAllTabs } = useEditorStore();

  // Close all button for open editors header
  const closeAllButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={closeAllTabs}
      className="h-5 w-5 hover:bg-sidebar-hover cursor-pointer"
      title="Close All"
    >
      <XCircle className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className={cn("h-full flex flex-col bg-sidebar-background", className)}>
      {/* Workspace Dropdown */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <WorkspaceDropdown />
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <SearchBar />
      </div>

      {/* Main content area - scrollable */}
      <div className="flex-1 overflow-auto">
        {/* EXPLORER heading */}
        <div className="px-3 py-2">
          <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            Explorer
          </h2>
        </div>

        {/* Open Editors Section - Default collapsed */}
        <CollapsibleSection
          title="Open Editors"
          isDefaultOpen={false}
          storageKey="open-editors"
          headerAction={closeAllButton}
        >
          <OpenedFilesSection />
        </CollapsibleSection>

        {/* File Explorer Section (includes filter and tree) */}
        <div className="flex-1">
          <FileExplorer />
        </div>
      </div>
    </div>
  );
}
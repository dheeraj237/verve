"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { usePanelStore } from "@/core/store/panel-store";
import { AppToolbar } from "@/shared/components/app-toolbar";
import { FileExplorer } from "@/features/file-explorer/components/file-explorer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    leftPanelSize,
    rightPanelSize,
    leftPanelCollapsed,
    rightPanelCollapsed,
    setLeftPanelSize,
    setRightPanelSize,
  } = usePanelStore();

  return (
    <div className="h-screen flex flex-col">
      <AppToolbar />
      
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {!leftPanelCollapsed && (
            <>
              <Panel
                defaultSize={leftPanelSize}
                minSize={15}
                maxSize={40}
                onResize={setLeftPanelSize}
                className="bg-sidebar-background"
              >
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-sidebar-border">
                    <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wide">
                      Explorer
                    </h3>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <FileExplorer />
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="w-1 bg-sidebar-border hover:bg-primary transition-colors" />
            </>
          )}

          <Panel defaultSize={100 - leftPanelSize - rightPanelSize}>
            <div className="h-full overflow-auto bg-editor-background">
              {children}
            </div>
          </Panel>

          {!rightPanelCollapsed && (
            <>
              <PanelResizeHandle className="w-1 bg-sidebar-border hover:bg-primary transition-colors" />
              <Panel
                defaultSize={rightPanelSize}
                minSize={10}
                maxSize={30}
                onResize={setRightPanelSize}
                className="bg-sidebar-background"
              >
                <div className="h-full overflow-auto">
                  {/* Table of Contents will go here */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold mb-2">OUTLINE</h3>
                    <div className="text-sm text-muted-foreground">
                      Table of contents will appear here
                    </div>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}

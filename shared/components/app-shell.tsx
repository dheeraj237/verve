"use client";

import { useRef, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";
import { usePanelStore } from "@/core/store/panel-store";
import { AppToolbar } from "@/shared/components/app-toolbar";
import { FileExplorer } from "@/features/file-explorer/components/file-explorer";
import { TableOfContents } from "@/features/markdown-preview/components/table-of-contents";
import { useTocStore } from "@/features/markdown-preview/store/toc-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  const {
    leftPanelSize,
    rightPanelSize,
    leftPanelCollapsed,
    rightPanelCollapsed,
    setLeftPanelSize,
    setRightPanelSize,
  } = usePanelStore();


  const { items: tocItems, activeId } = useTocStore();

  useEffect(() => {
    if (leftPanelRef.current) {
      if (leftPanelCollapsed) {
        leftPanelRef.current.collapse();
      } else {
        leftPanelRef.current.expand();
      }
    }
  }, [leftPanelCollapsed]);

  useEffect(() => {
    if (rightPanelRef.current) {
      if (rightPanelCollapsed) {
        rightPanelRef.current.collapse();
      } else {
        rightPanelRef.current.expand();
      }
    }
  }, [rightPanelCollapsed]);

  return (
    <div className="h-screen flex flex-col">
      <AppToolbar />
      
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="main-layout">
          <Panel
            ref={leftPanelRef}
            id="left-panel"
            defaultSize={leftPanelSize}
            minSize={15}
            maxSize={40}
            collapsible
            onResize={setLeftPanelSize}
            className="bg-sidebar-background border-r border-sidebar-border"
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

          <PanelResizeHandle className="w-1 bg-sidebar-border hover:bg-primary hover:w-1.5 transition-all cursor-col-resize data-[panel-group-direction=horizontal]:w-1" />

          <Panel id="center-panel" minSize={30} defaultSize={50}>
            <div className="h-full overflow-auto bg-editor-background">
              {children}
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-sidebar-border hover:bg-primary hover:w-1.5 transition-all cursor-col-resize data-[panel-group-direction=horizontal]:w-1" />

          <Panel
            ref={rightPanelRef}
            id="right-panel"
            defaultSize={rightPanelSize}
            minSize={10}
            maxSize={30}
            collapsible
            onResize={setRightPanelSize}
            className="bg-sidebar-background border-l border-sidebar-border"
          >
            <TableOfContents items={tocItems} activeId={activeId} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

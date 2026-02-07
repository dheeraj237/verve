"use client";

import { useRef, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";
import { usePanelStore } from "@/core/store/panel-store";
import { AppToolbar } from "@/shared/components/app-toolbar";
import { FileExplorer } from "@/features/file-explorer/components/file-explorer";
import { TableOfContents } from "@/features/editor/components/table-of-contents";
import { useTocStore } from "@/features/editor/store/toc-store";
import { useEditorStore, useCurrentFile } from "@/features/editor/store/editor-store";
import { isMarkdownFile } from "@/shared/utils/file-type-detector";

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

  const { activeTabId, isCodeViewMode } = useEditorStore();
  const currentFile = useCurrentFile();
  const { items: tocItems, activeId } = useTocStore();

  // Show TOC only for markdown files when in live mode (not code mode)
  const showToc = activeTabId !== null && currentFile && isMarkdownFile(currentFile.name) && !isCodeViewMode;

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
            <FileExplorer />
          </Panel>

          <PanelResizeHandle className="w-1 bg-sidebar-border hover:bg-primary hover:w-1.5 transition-all cursor-col-resize data-[panel-group-direction=horizontal]:w-1" />

          <Panel id="center-panel" minSize={30} defaultSize={50}>
            <div className="h-full flex flex-col bg-editor-background">
              {children}
            </div>
          </Panel>

          {showToc && (
            <>
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
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}

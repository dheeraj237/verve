import { useRef, useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";
import { usePanelStore } from "@/core/store/panel-store";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import { AppToolbar } from "@/shared/components/app-toolbar";
import { MobileBottomMenu } from "@/shared/components/mobile-bottom-menu";
import { FileExplorer } from "@/features/file-explorer/components/file-explorer";
import { LeftNavigationPanel } from "@/shared/components/left-navigation-panel";
import { TableOfContents } from "@/features/editor/components/table-of-contents";
import { useTocStore } from "@/features/editor/store/toc-store";
import { useLoadingStore } from '@/core/store/loading-store';
import { useEditorStore, useCurrentFile } from "@/features/editor/store/editor-store";
import { isMarkdownFile } from "@/shared/utils/file-type-detector";
import { isMobileOrTablet, onViewportChange } from "@/shared/utils/mobile";

export function AppShell({ children }: { children: React.ReactNode }) {
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const [isMobile, setIsMobile] = useState(false);

  const {
    leftPanelCollapsed,
    rightPanelCollapsed,
    closeLeftPanel,
    closeRightPanel,
    openLeftPanel,
    openRightPanel,
  } = usePanelStore();

  const { isWorkspaceSwitching } = useWorkspaceStore();
  const isLoading = useLoadingStore((s) => s.isLoading);
  const { activeTabId, isCodeViewMode } = useEditorStore();
  const currentFile = useCurrentFile();
  const { items: tocItems, activeId } = useTocStore();

  // Show TOC only for markdown files when in live mode (not code mode)
  const showToc = activeTabId !== null && currentFile && isMarkdownFile(currentFile.name) && !isCodeViewMode;

  // Track mobile state and handle responsive behavior
  useEffect(() => {
    setIsMobile(isMobileOrTablet());
    const cleanup = onViewportChange(() => {
      setIsMobile(isMobileOrTablet());
    });
    return cleanup;
  }, []);

  // Auto-close left panel when file is selected on mobile
  useEffect(() => {
    if (isMobile && activeTabId !== null) {
      closeLeftPanel();
    }
  }, [activeTabId, isMobile, closeLeftPanel]);

  // On mobile, if no file is opened, ensure left panel is visible at 90%
  useEffect(() => {
    if (isMobile && activeTabId === null && leftPanelRef.current) {
      // set a large width for explorer and open
      leftPanelRef.current.resize(90);
      openLeftPanel();
    }
  }, [activeTabId, isMobile, openLeftPanel]);

  // Auto-close right panel when heading is selected on mobile
  useEffect(() => {
    // Only act when there's a real selection (non-empty string)
    if (isMobile && activeId) {
      closeRightPanel();
    }
  }, [activeId, isMobile, closeRightPanel]);

  // When TOC becomes visible on mobile (live mode), open it at 90%
  useEffect(() => {
    if (isMobile && showToc && rightPanelRef.current) {
      rightPanelRef.current.resize(90);
      openRightPanel();
    }
    // If TOC is not shown, ensure it's closed on mobile
    if (isMobile && !showToc) {
      closeRightPanel();
    }
  }, [isMobile, showToc, openRightPanel, closeRightPanel]);

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
    <div className="h-screen flex flex-col relative">
      <AppToolbar />
      
      <div className="flex-1 overflow-hidden pb-14 lg:pb-0 relative">
        {/* Workspace switching overlay - disables pointer events */}
        {(isWorkspaceSwitching || isLoading) && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 pointer-events-auto">
            <div className="h-full w-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-muted-foreground">Switching workspace...</p>
              </div>
            </div>
          </div>
        )}

        <PanelGroup direction="horizontal" autoSaveId="main-layout">
          <Panel
            ref={leftPanelRef}
            id="left-panel"
            defaultSize={isMobile ? 90 : 20}
            minSize={isMobile ? 0 : 15}
            maxSize={isMobile ? 90 : 40}
            collapsible
            className="bg-sidebar-background border-r border-sidebar-border"
          >
            <LeftNavigationPanel />
          </Panel>

          <PanelResizeHandle className="w-1 bg-sidebar-border hover:bg-primary hover:w-1.5 transition-all cursor-col-resize" />

          <Panel id="center-panel" minSize={isMobile ? 0 : 30} defaultSize={isMobile ? 10 : 50}>
            <div className="h-full flex flex-col bg-editor-background">
              {children}
            </div>
          </Panel>

          {showToc && (
            <>
              <PanelResizeHandle className="w-1 bg-sidebar-border hover:bg-primary hover:w-1.5 transition-all cursor-col-resize" />

              <Panel
                ref={rightPanelRef}
                id="right-panel"
                defaultSize={isMobile ? 90 : 20}
                minSize={isMobile ? 0 : 10}
                maxSize={isMobile ? 90 : 30}
                collapsible
                className="bg-sidebar-background border-l border-sidebar-border"
              >
                <TableOfContents items={tocItems} activeId={activeId} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Mobile bottom menu - only visible on screens below lg breakpoint */}
      <MobileBottomMenu />
    </div>
  );
}

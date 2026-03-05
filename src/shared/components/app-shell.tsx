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

  const { leftPanelOpen, rightPanelOpen, leftSize, rightSize, setLeftSize, setRightSize } = usePanelStore();

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
  // NOTE: Mobile auto-open/close behavior has been removed. Panel visibility
  // is controlled by explicit toggles. Size persistence and control are
  // delegated to react-resizable-panels (via `autoSaveId`) instead of storing
  // sizes in the app store.

  useEffect(() => {
    if (!leftPanelRef.current) return;
    if (leftPanelOpen) leftPanelRef.current.expand();
    else leftPanelRef.current.collapse();
  }, [leftPanelOpen]);

  useEffect(() => {
    if (!rightPanelRef.current) return;
    if (rightPanelOpen) rightPanelRef.current.expand();
    else rightPanelRef.current.collapse();
  }, [rightPanelOpen]);

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

        {/* @ts-ignore: react-resizable-panels onLayout callback (sizes array) */}
        <PanelGroup
          direction="horizontal"
          autoSaveId="main-layout"
          onLayout={(sizes: any) => {
            // sizes is an array of fractions summing to 1. Map to percentages.
            if (Array.isArray(sizes) && sizes.length) {
              const leftPct = Math.round((sizes[0] || 0) * 100);
              const rightPct = Math.round((sizes[sizes.length - 1] || 0) * 100);
              setLeftSize(leftPct);
              setRightSize(rightPct);
            }
          }}
        >
          <Panel
            ref={leftPanelRef}
            id="left-panel"
            defaultSize={isMobile ? 90 : leftSize}
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
                defaultSize={isMobile ? 90 : rightSize}
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

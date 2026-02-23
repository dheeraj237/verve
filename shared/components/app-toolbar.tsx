"use client";

import { PanelLeft, PanelRight, PanelLeftClose, PanelRightClose, Code2, Sparkles, FolderPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { UserMenu } from "@/shared/components/user-menu";
import { usePanelStore } from "@/core/store/panel-store";
import { useEditorStore, useCurrentFile } from "@/features/editor/store/editor-store";
import { Separator } from "@/shared/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { isMarkdownFile } from "@/shared/utils/file-type-detector";
import { cn } from "@/shared/utils/cn";
import { APP_TITLE, isFeatureEnabled } from "@/core/config/features";
import { toast } from "@/shared/utils/toast";
import { useUserStore } from "@/core/store/user-store";
import { ensureGisLoaded, requestAccessTokenForScopes, getGoogleUserProfile } from "@/core/auth/google";
import { useState } from "react";
import React from "react";

const LazyGoogleDrivePicker = React.lazy(async () => {
  const m = await import("@/shared/components/google-drive-picker");
  const Picker = (m as any).GoogleDrivePicker || (m as any).default;

  const Wrapped = (props: any) => {
    const onFolderSelected = async (id: string) => {
      try {
        const storeMod = await import("@/features/editor/store/editor-store");
        if (storeMod && typeof (storeMod as any).enableGoogleDrive === "function") {
          (storeMod as any).enableGoogleDrive(id);
        } else {
          window.localStorage.setItem("verve_gdrive_folder_id", id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    return React.createElement(Picker, { onFolderSelected, ...props });
  };

  return { default: Wrapped };
});

export function AppToolbar() {
  const navigate = useNavigate();
  const { toggleLeftPanel, toggleRightPanel, leftPanelCollapsed, rightPanelCollapsed } = usePanelStore();
  const { activeTabId, isCodeViewMode, setCodeViewMode } = useEditorStore();
  const currentFile = useCurrentFile();
  const { isLoggedIn, setProfile } = useUserStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const hasActiveFile = activeTabId !== null;
  const isMarkdown = currentFile ? isMarkdownFile(currentFile.name) : false;
  const appTitleEnabled = isFeatureEnabled("appTitle");
  const driveEnabled = isFeatureEnabled("googleDriveSync");

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);

      // Check if Client ID is configured
      const clientId = import.meta.env.VITE_AUTH_APP_CLIENT_ID;
      if (!clientId) {
        toast.error("Google Client ID not configured. Please set VITE_AUTH_APP_CLIENT_ID environment variable.");
        setIsLoggingIn(false);
        return;
      }

      await ensureGisLoaded();
      const token = await requestAccessTokenForScopes("openid profile email", true);
      if (token) {
        // Pass the token to getGoogleUserProfile to avoid requesting a new token
        const userProfile = await getGoogleUserProfile(token, false);
        if (userProfile) {
          console.log("User profile retrieved:", userProfile);
          setProfile(userProfile);
          window.localStorage.setItem("verve_gdrive_logged_in", "1");
          toast.success(`Welcome, ${userProfile.name || userProfile.email}!`);
        } else {
          toast.error("Failed to fetch user profile. Please try again.");
        }
      } else {
        toast.info("Google login cancelled");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      const errorMessage = err?.message || "Google login failed";

      if (errorMessage.includes("redirect_uri_mismatch")) {
        toast.error("OAuth Configuration Error: Please verify your Google OAuth redirect URI settings.");
      } else if (errorMessage.includes("invalid_client")) {
        toast.error("Invalid Client ID: Please verify VITE_AUTH_APP_CLIENT_ID is correct.");
      } else if (errorMessage.includes("access_denied") || errorMessage.includes("cancelled")) {
        toast.error("Login cancelled. Please ensure popups are enabled in your browser.");
      } else if (errorMessage.includes("timeout")) {
        toast.error("Login request timed out. Please check your internet connection and try again.");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="h-12 border-b bg-background px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        {appTitleEnabled && (
          <button
            onClick={() => navigate("/")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title={`${APP_TITLE} - Document Everything`}
          >
            {APP_TITLE}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Code/Live Switcher - only for markdown files, all screen sizes */}
        {hasActiveFile && isMarkdown && (
          <>
            <Tabs value={isCodeViewMode ? "code" : "live"} onValueChange={(value) => setCodeViewMode(value === "code")}>
              <TabsList className="h-8">
                <TabsTrigger value="code" className="gap-1.5 cursor-pointer" title="Code Editor">
                  <Code2 className={cn("h-3.5 w-3.5", !isCodeViewMode && "text-muted-foreground")} />
                  <span className="hidden sm:inline text-xs">Code</span>
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-1.5 cursor-pointer" title="Live Preview Editor">
                  <Sparkles className={cn("h-3.5 w-3.5", isCodeViewMode && "text-muted-foreground")} />
                  <span className="hidden sm:inline text-xs">Live</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}

        {/* Panel toggles - only on desktop */}
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer h-8 w-8 hidden lg:inline-flex"
          onClick={toggleLeftPanel}
        >
          {leftPanelCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
              <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer h-8 w-8 hidden lg:inline-flex"
          onClick={toggleRightPanel}
        >
          {rightPanelCollapsed ? (
            <PanelRight className="h-4 w-4" />
          ) : (
              <PanelRightClose className="h-4 w-4" />
          )}
        </Button>

        <Separator orientation="vertical" className="h-6 hidden lg:block" />
        {driveEnabled && isLoggedIn && (
          <div className="hidden lg:inline-flex">
            {/* Lazy-load the picker component to avoid increasing bundle size */}
            <React.Suspense fallback={
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <FolderPlus className="h-4 w-4" />
              </Button>
            }>
              <LazyGoogleDrivePicker />
            </React.Suspense>
          </div>
        )}
        <ThemeToggle />
        {!isLoggedIn && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="h-8 hidden sm:inline-flex"
          >
            {isLoggingIn ? "Logging in..." : "Login"}
          </Button>
        )}
        {isLoggedIn && <UserMenu />}
      </div>
    </div>
  );
}

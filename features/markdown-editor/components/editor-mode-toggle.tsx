"use client";

import { FileText, Eye, Code2, Sparkles } from "lucide-react";
import { ViewMode } from "@/shared/types";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/cn";

interface EditorModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function EditorModeToggle({ mode, onModeChange }: EditorModeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 bg-muted/30 rounded-md p-0.5">
          <Button
              variant="ghost"
              size="icon"
              className={cn(
                  "h-8 w-8 cursor-pointer",
                  mode === "code" && "bg-background shadow-sm"
              )}
              onClick={() => onModeChange("code")}
              title="Code Editor"
          >
              <Code2 className="h-4 w-4" />
          </Button>
          <Button
              variant="ghost"
              size="icon"
              className={cn(
                  "h-8 w-8 cursor-pointer",
                  mode === "live" && "bg-background shadow-sm"
              )}
              onClick={() => onModeChange("live")}
              title="Live Preview Editor (Obsidian-like)"
          >
              <Sparkles className="h-4 w-4" />
          </Button>
          <Button
              variant="ghost"
              size="icon"
              className={cn(
                  "h-8 w-8 cursor-pointer",
                  mode === "preview" && "bg-background shadow-sm"
              )}
              onClick={() => onModeChange("preview")}
              title="Preview Mode"
          >
              <Eye className="h-4 w-4" />
          </Button>
          <Button
              variant="ghost"
              size="icon"
              className={cn(
                  "h-8 w-8 cursor-pointer",
                  mode === "editor" && "bg-background shadow-sm"
              )}
              onClick={() => onModeChange("editor")}
              title="Rich Text Editor (Milkdown)"
          >
              <FileText className="h-4 w-4" />
          </Button>
    </div>
  );
}

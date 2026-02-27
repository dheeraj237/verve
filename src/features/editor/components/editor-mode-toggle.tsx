"use client";

import { Eye, Code2, Sparkles } from "lucide-react";
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
                  mode === ViewMode.Code && "bg-background shadow-sm"
              )}
              onClick={() => onModeChange(ViewMode.Code)}
              title="Code Editor"
          >
              <Code2 className={cn("h-4 w-4", mode !== "code" && "text-muted-foreground")} />
          </Button>
          <Button
              variant="ghost"
              size="icon"
              className={cn(
                  "h-8 w-8 cursor-pointer",
                  mode === ViewMode.Live && "bg-background shadow-sm"
              )}
              onClick={() => onModeChange(ViewMode.Live)}
              title="Live Preview Editor (Obsidian-like)"
          >
              <Sparkles className={cn("h-4 w-4", mode !== "live" && "text-muted-foreground")} />
          </Button>
          <Button
              variant="ghost"
              size="icon"
              className={cn(
                  "h-8 w-8 cursor-pointer",
                  mode === ViewMode.Preview && "bg-background shadow-sm"
              )}
              onClick={() => onModeChange(ViewMode.Preview)}
              title="Preview Mode"
          >
              <Eye className={cn("h-4 w-4", mode !== "preview" && "text-muted-foreground")} />
          </Button>
    </div>
  );
}

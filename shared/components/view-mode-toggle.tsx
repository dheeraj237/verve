"use client";

import { Eye, Edit, SplitSquareHorizontal } from "lucide-react";
import { ViewMode } from "@/shared/types";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/cn";

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
  const modes: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
    { value: "preview", icon: <Eye className="h-4 w-4" />, label: "Preview" },
    { value: "edit", icon: <Edit className="h-4 w-4" />, label: "Edit" },
    {
      value: "split",
      icon: <SplitSquareHorizontal className="h-4 w-4" />,
      label: "Split",
    },
  ];

  return (
    <div className="flex items-center border rounded-md">
      {modes.map((m) => (
        <Button
          key={m.value}
          variant="ghost"
          size="sm"
          onClick={() => onModeChange(m.value)}
          className={cn(
            "rounded-none border-r last:border-r-0",
            mode === m.value && "bg-accent"
          )}
          title={m.label}
        >
          {m.icon}
        </Button>
      ))}
    </div>
  );
}

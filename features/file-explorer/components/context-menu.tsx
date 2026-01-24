"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, FolderPlus, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  isFolder: boolean;
}

export function ContextMenu({
  x,
  y,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  isFolder,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1"
      style={{ left: x, top: y }}
    >
      {isFolder && (
        <>
          <button
            onClick={onNewFile}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left"
          >
            <FileText className="h-4 w-4" />
            New File
          </button>
          <button
            onClick={onNewFolder}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <div className="h-px bg-border my-1" />
        </>
      )}
      <button
        onClick={onRename}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left"
      >
        <Edit2 className="h-4 w-4" />
        Rename
      </button>
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive transition-colors text-left"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}

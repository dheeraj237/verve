"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/shared/components/ui/button";

interface RenameDialogProps {
  currentName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ currentName, onConfirm, onCancel }: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Select filename without extension
    const dotIndex = currentName.lastIndexOf('.');
    if (dotIndex > 0) {
      inputRef.current?.setSelectionRange(0, dotIndex);
    } else {
      inputRef.current?.select();
    }
  }, [currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name !== currentName) {
      onConfirm(name.trim());
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-popover border border-border rounded-lg shadow-lg p-4 min-w-[400px]">
        <h3 className="text-lg font-semibold mb-3">Rename</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || name === currentName}>
              Rename
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

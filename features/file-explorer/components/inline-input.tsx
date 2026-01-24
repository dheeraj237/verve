"use client";

import { useState, useEffect, useRef } from "react";
import { File, Folder } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface InlineInputProps {
  type: "file" | "folder";
  level: number;
  defaultValue: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  existingNames: string[];
}

export function InlineInput({
  type,
  level,
  defaultValue,
  onConfirm,
  onCancel,
  existingNames,
}: InlineInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Select filename without extension
    const dotIndex = defaultValue.lastIndexOf('.');
    if (dotIndex > 0 && type === 'file') {
      inputRef.current?.setSelectionRange(0, dotIndex);
    } else {
      inputRef.current?.select();
    }
  }, [defaultValue, type]);

  const validateName = (name: string): string | null => {
    if (!name.trim()) {
      return "Name cannot be empty";
    }
    if (name.includes('/') || name.includes('\\')) {
      return "Name cannot contain / or \\";
    }
    if (existingNames.includes(name)) {
      return "A file or folder with this name already exists";
    }
    return null;
  };

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    const validationError = validateName(trimmedValue);
    
    if (validationError) {
      setError(validationError);
      return;
    }
    
    onConfirm(trimmedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Small delay to allow click events to fire
    setTimeout(() => {
      if (value.trim()) {
        handleSubmit();
      } else {
        onCancel();
      }
    }, 100);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 bg-accent",
          error && "border border-destructive"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {type === "folder" ? (
          <Folder className="h-4 w-4 text-primary flex-shrink-0" />
        ) : (
          <>
            <div className="w-4" />
            <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="flex-1 text-sm bg-transparent border-none outline-none"
        />
      </div>
      {error && (
        <div 
          className="text-xs text-destructive px-2 py-0.5"
          style={{ paddingLeft: `${level * 12 + 32}px` }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

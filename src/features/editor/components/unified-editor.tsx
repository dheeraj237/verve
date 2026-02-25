"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FileText } from "lucide-react";
import { useEditorStore, useCurrentFile } from "@/features/editor/store/editor-store";
import { FileTabs } from "./file-tabs";
import { CodeEditor } from "./code-editor";
import { useTocStore } from "@/features/editor/store/toc-store";
import { useTableOfContents } from "@/features/editor/hooks/use-table-of-contents";
import { sanitizeMarkdown } from "@/shared/utils/sanitize";
import { toast } from "@/shared/utils/toast";
import { LiveMarkdownEditor } from "./live-markdown-editor";
import { isMarkdownFile } from "@/shared/utils/file-type-detector";

export function Editor() {
  const { isLoading, applyEditorPatch, setFileSaving, setFileLastSaved, isCodeViewMode, setCodeViewMode, editorViewKey } = useEditorStore();
  const currentFile = useCurrentFile();
  const [editableContent, setEditableContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>("");
  const currentFileRef = useRef(currentFile);
  
  // TOC integration - only for markdown files
  const { setItems, setActiveId } = useTocStore();
  const isMarkdown = currentFile ? isMarkdownFile(currentFile.name) : false;
  const headings = useTableOfContents(isMarkdown ? editableContent : "");

  // Sync currentFileRef with currentFile
  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);

  useEffect(() => {
    if (currentFile) {
      setEditableContent(currentFile.content);
      lastContentRef.current = currentFile.content;
      setHasChanges(false);
    }
  }, [currentFile?.id]);

  // Update TOC when headings change (markdown files only)
  useEffect(() => {
    setItems(isMarkdown ? headings : []);
  }, [headings, setItems, isMarkdown]);

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (!currentFile || !hasChanges) return;

    setFileSaving(currentFile.id, true);

    // Sanitize content before saving
    const sanitizedContent = sanitizeMarkdown(editableContent);

    try {
      // Try to use FileManager if file is in cache, otherwise fallback to direct API
      try {
        await applyEditorPatch(currentFile.id, sanitizedContent);
      } catch (fileManagerError) {
        // If file not in cache, use direct save method
        console.warn("FileManager not available, using direct save:", fileManagerError);

      // For local files with fileHandle
        if (currentFile.isLocal && currentFile.fileHandle) {
          const writable = await currentFile.fileHandle.createWritable();
          await writable.write(sanitizedContent);
          await writable.close();
        } else {
          // For browser/demo workspace files, use browser adapter directly
          const { getBrowserAdapter } = await import('@/hooks/use-browser-mode');
          const adapter = getBrowserAdapter();
          await adapter.writeFile(currentFile.path, sanitizedContent);
        }
      }

      setHasChanges(false);
      const savedTime = new Date();
      setFileLastSaved(currentFile.id, savedTime);
      lastContentRef.current = sanitizedContent;

      if (!isAutoSave) {
        toast.success("File saved", `${currentFile.name} saved successfully`);
      }
    } catch (error) {
      console.error("Failed to save file:", error);
      if (!isAutoSave) {
        toast.error("Save failed", error instanceof Error ? error.message : "Unknown error");
      }
    } finally {
      setFileSaving(currentFile.id, false);
    }
  }, [currentFile, hasChanges, editableContent, applyEditorPatch, setFileSaving, setFileLastSaved]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!hasChanges || !currentFile) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [editableContent, hasChanges, currentFile, handleSave]);

  const handleContentChange = useCallback((content: string) => {
    setEditableContent(content);
    if (currentFileRef.current) {
      setHasChanges(content !== currentFileRef.current.content);
    }
  }, []);

  if (!currentFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <FileText className="h-24 w-24 text-muted-foreground mb-6" />
        <h2 className="text-xl font-semibold mb-2">No file selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Select a markdown file from the explorer to view or edit
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center bg-background border-b border-border shrink-0">
        <FileTabs />
      </div>

          {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
              </div>
          ) : (
              <>
            {isMarkdown ? (
              isCodeViewMode ? (
                <CodeEditor
                  key={`code-${currentFile.id}-${editorViewKey}`}
                  file={{ ...currentFile, content: editableContent }}
                  onContentChange={handleContentChange}
                />
              ) : (
                <LiveMarkdownEditor
                  key={`live-${currentFile.id}-${editorViewKey}`}
                  file={{ ...currentFile, content: editableContent }}
                  onContentChange={handleContentChange}
                />
              )
            ) : (
              <CodeEditor
                file={{ ...currentFile, content: editableContent }}
                onContentChange={handleContentChange}
              />
            )}
          </>
      )}
    </div>
  );
}

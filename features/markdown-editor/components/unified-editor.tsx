"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FileText, Save } from "lucide-react";
import { useEditorStore, useCurrentFile } from "@/features/markdown-editor/store/editor-store";
import { Button } from "@/shared/components/ui/button";
import { FileTabs } from "./file-tabs";
import { EditorModeToggle } from "./editor-mode-toggle";
import { CodeEditor } from "./code-editor";
import { MarkdownPreview } from "@/features/markdown-preview/components/markdown-preview";
import { useTocStore } from "@/features/markdown-preview/store/toc-store";
import { useTableOfContents } from "@/features/markdown-preview/hooks/use-table-of-contents";
import { useActiveHeading } from "@/features/markdown-preview/hooks/use-active-heading";
import { sanitizeMarkdown } from "@/shared/utils/sanitize";
import { toast } from "@/shared/utils/toast";
import { LiveMarkdownEditor } from "./live-markdown-editor";

export function UnifiedEditor() {
  const { viewMode, setViewMode, isLoading, applyEditorPatch } = useEditorStore();
  const currentFile = useCurrentFile();
  const [editableContent, setEditableContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>("");
  
  // TOC integration
  const { setItems, setActiveId } = useTocStore();
  const headings = useTableOfContents(editableContent);
  // Only use useActiveHeading for preview mode (it tracks scroll in #markdown-content)
  // Live mode handles its own scroll tracking in LiveMarkdownEditor
  const activeId = useActiveHeading(viewMode === "preview" ? headings.map(h => h.id) : []);

  useEffect(() => {
    if (currentFile) {
      setEditableContent(currentFile.content);
      lastContentRef.current = currentFile.content;
      setHasChanges(false);
    }
  }, [currentFile?.id]);

  // Update TOC when content or headings change
  useEffect(() => {
    setItems(headings);
  }, [headings, setItems]);

  // Update active heading in TOC (only for preview mode)
  // Live mode manages activeId through its own scroll tracking
  useEffect(() => {
    if (viewMode === "preview" && activeId) {
      setActiveId(activeId);
    }
  }, [activeId, setActiveId, viewMode]);

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (!currentFile || !hasChanges) return;

    setIsSaving(true);

    // Sanitize content before saving
    const sanitizedContent = sanitizeMarkdown(editableContent);

    try {
      // Try to use FileManager if file is in cache, otherwise fallback to direct API
      try {
        await applyEditorPatch(currentFile.id, sanitizedContent);
      } catch (fileManagerError) {
        // If file not in cache, use legacy save method
        console.warn("FileManager not available, using direct save:", fileManagerError);

      // For local files with fileHandle
        if (currentFile.isLocal && currentFile.fileHandle) {
          const writable = await currentFile.fileHandle.createWritable();
          await writable.write(sanitizedContent);
          await writable.close();
        } else {
          // For server files
          const response = await fetch(`/api/files/${currentFile.path}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content: sanitizedContent }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to save file");
          }
        }
      }

      setHasChanges(false);
      setLastSaved(new Date());
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
      setIsSaving(false);
    }
  }, [currentFile, hasChanges, editableContent, applyEditorPatch]);

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
    if (currentFile) {
      setHasChanges(content !== currentFile.content);
    }
  }, [currentFile]);

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
      <div className="flex items-center bg-muted/30 border-b border-border shrink-0">
        <FileTabs />
        
        <div className="ml-auto flex items-center gap-2 px-4 py-2">
          <EditorModeToggle mode={viewMode} onModeChange={setViewMode} />
          
          <div className="flex items-center gap-2 ml-2">
            {isSaving && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}
            {!isSaving && hasChanges && (
              <span className="text-xs text-muted-foreground">Unsaved</span>
            )}
            {!isSaving && !hasChanges && lastSaved && (
              <span className="text-xs text-muted-foreground">
                {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <Button
              size="sm"
              onClick={() => handleSave(false)}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>
      </div>

          {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
              </div>
          ) : (
              <>
            {viewMode === "preview" && (
              <div id="markdown-content" className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="max-w-4xl mx-auto px-8 py-8 pb-24">
                  <MarkdownPreview content={editableContent} currentFilePath={currentFile.path} />
                </div>
              </div>
            )}

            {viewMode === "live" && (
              <LiveMarkdownEditor
                file={{ ...currentFile, content: editableContent }}
                onContentChange={handleContentChange}
              />
            )}

            {viewMode === "code" && (
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

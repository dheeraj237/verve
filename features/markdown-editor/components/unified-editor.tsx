"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Crepe } from "@milkdown/crepe";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { FileText, Save } from "lucide-react";
import { useEditorStore, useCurrentFile } from "@/features/markdown-editor/store/editor-store";
import { Button } from "@/shared/components/ui/button";
import { FileTabs } from "./file-tabs";
import { EditorModeToggle } from "./editor-mode-toggle";
import { CodeEditor } from "./code-editor";
import { MarkdownPreview } from "@/features/markdown-preview/components/markdown-preview";
import { MarkdownFile } from "@/shared/types";
import { useTocStore } from "@/features/markdown-preview/store/toc-store";
import { useTableOfContents } from "@/features/markdown-preview/hooks/use-table-of-contents";
import { useActiveHeading } from "@/features/markdown-preview/hooks/use-active-heading";
import { sanitizeMarkdown } from "@/shared/utils/sanitize";
import { toast } from "@/shared/utils/toast";
import { useTheme } from "next-themes";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { LiveMarkdownEditor } from "./live-markdown-editor";

function CrepeEditor({ file, onContentChange }: { file: MarkdownFile; onContentChange: (content: string) => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const loading = useRef(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!divRef.current || loading.current || !mounted) return;

    loading.current = true;

    const crepe = new Crepe({
      root: divRef.current,
      defaultValue: file.content,
      features: {
        // Enable all features like playground
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.ListItem]: true,
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.ImageBlock]: true,
        [Crepe.Feature.BlockEdit]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.Toolbar]: true,
        [Crepe.Feature.Cursor]: true,
        [Crepe.Feature.Placeholder]: true,
        [Crepe.Feature.Latex]: true,
      },
      featureConfigs: {
        [Crepe.Feature.LinkTooltip]: {
          onCopyLink: () => {
            toast.success("Link copied", "Link copied to clipboard");
          },
        },
        [Crepe.Feature.Placeholder]: {
          text: "Start writing your markdown...",
        },
      },
    });

    // Configure listener for content changes
    crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          // Normalize the markdown to prevent extra blank lines
          const normalized = markdown
            .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
            .replace(/\n+$/g, '\n'); // Remove trailing newlines except one
          onContentChange(normalized);
        });
      })
      .use(listener);

    crepe.create().then(() => {
      crepeRef.current = crepe;
      loading.current = false;
    });

    return () => {
      if (loading.current) return;
      crepe.destroy();
      crepeRef.current = null;
      loading.current = false;
    };
  }, [file.id, isDark, onContentChange, mounted]);

  // Update content when file changes
  useEffect(() => {
    if (!crepeRef.current) return;
    const currentMarkdown = crepeRef.current.getMarkdown();
    if (currentMarkdown !== file.content) {
      // We need to recreate the editor with new content
      // since there's no direct way to update content in Crepe
    }
  }, [file.content]);

  return (
    <div className="crepe flex-1 overflow-auto" ref={divRef} />
  );
}

export function UnifiedEditor() {
  const { viewMode, setViewMode, isLoading, updateFileContent } = useEditorStore();
  const currentFile = useCurrentFile();
  const [editableContent, setEditableContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // TOC integration
  const { setItems, setActiveId } = useTocStore();
  const headings = useTableOfContents(editableContent);
  const activeId = useActiveHeading(headings.map(h => h.id));

  useEffect(() => {
    if (currentFile) {
      setEditableContent(currentFile.content);
      setHasChanges(false);
    }
  }, [currentFile?.id]);

  // Update TOC when content or headings change
  useEffect(() => {
    setItems(headings);
  }, [headings, setItems]);

  // Update active heading in TOC
  useEffect(() => {
    setActiveId(activeId);
  }, [activeId, setActiveId]);

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (!currentFile || !hasChanges) return;

    setIsSaving(true);

      // Sanitize content before saving
      const sanitizedContent = sanitizeMarkdown(editableContent);

    try {
        // If it's a local file with fileHandle, save directly to local file system
        if (currentFile.isLocal && currentFile.fileHandle) {
            try {
                const writable = await currentFile.fileHandle.createWritable();
                await writable.write(sanitizedContent);
                await writable.close();

                updateFileContent(currentFile.id, sanitizedContent);
                setHasChanges(false);
                setLastSaved(new Date());

                if (!isAutoSave) {
                    toast.success("File saved", `${currentFile.name} saved successfully`);
                }
                return;
            } catch (error) {
                console.error("Failed to save local file:", error);
                toast.error("Save failed", (error as Error).message);
                throw new Error("Failed to save local file: " + (error as Error).message);
            }
        }

        // Otherwise, save to server
      const response = await fetch(`/api/files/${currentFile.path}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
          body: JSON.stringify({ content: sanitizedContent }),
      });

      if (!response.ok) {
        const error = await response.json();
          toast.error("Save failed", error.error || "Failed to save file");
        throw new Error(error.error || "Failed to save file");
      }

        updateFileContent(currentFile.id, sanitizedContent);
      setHasChanges(false);
      setLastSaved(new Date());

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
  }, [currentFile, hasChanges, editableContent, updateFileContent]);

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
      <div className="flex items-center bg-muted/30 border-border">
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
                          <div id="markdown-content" className="flex-1 overflow-auto">
                              <div className="max-w-[800px] mx-auto px-12 py-12">
                                  <MarkdownPreview content={editableContent} />
                              </div>
                          </div>
                      )}

                      {viewMode === "editor" && (
              <CrepeEditor
                file={{ ...currentFile, content: editableContent }}
                onContentChange={handleContentChange}
              />
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

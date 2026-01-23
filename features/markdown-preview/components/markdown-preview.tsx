"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import { FileText } from "lucide-react";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { useEffect } from "react";

export function MarkdownPreview() {
  const { currentFile, isLoading } = useEditorStore();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!currentFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <FileText className="h-24 w-24 text-muted-foreground mb-6" />
        <h2 className="text-xl font-semibold mb-2">No file selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Select a markdown file from the explorer to view its contents
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypePrism as any]}
          >
            {currentFile.content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}

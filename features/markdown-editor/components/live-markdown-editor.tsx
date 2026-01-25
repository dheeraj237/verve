"use client";

import { useEffect, useRef, useState } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Table, TaskList, GFM, Strikethrough } from "@lezer/markdown";
import { 
  livePreviewPlugin, 
  markdownStylePlugin, 
  codeBlockField, 
  linkPlugin, 
  imageField, 
  collapseOnSelectionFacet,
  mouseSelectingField,
  setMouseSelecting,
  editorTheme,
  mathPlugin,
  blockMathField,
  tableField,
} from "codemirror-live-markdown";
import { useTheme } from "next-themes";
import { MarkdownFile } from "@/shared/types";
import { Eye, Code2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { mermaidField, updateMermaidDiagrams } from "./mermaid-live-plugin";

// Import themes
import { eclipse } from "@uiw/codemirror-theme-eclipse";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

// Import KaTeX CSS
import "katex/dist/katex.min.css";

interface LiveMarkdownEditorProps {
  file: MarkdownFile;
  onContentChange: (content: string) => void;
}

export function LiveMarkdownEditor({ file, onContentChange }: LiveMarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const themeCompartment = useRef(new Compartment());
  const modeCompartment = useRef(new Compartment());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Setup mouse selecting handler (like the demo)
  const setupMouseSelecting = (view: EditorView) => {
    view.contentDOM.addEventListener('mousedown', () => {
      view.dispatch({ effects: setMouseSelecting.of(true) });
    });

    document.addEventListener('mouseup', () => {
      requestAnimationFrame(() => {
        if (viewRef.current) {
          viewRef.current.dispatch({ effects: setMouseSelecting.of(false) });
        }
      });
    });
  };

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current || !mounted) return;

    const currentTheme = theme === "dark" ? vscodeDark : eclipse;

    const state = EditorState.create({
      doc: file.content,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ 
          base: markdownLanguage, 
          extensions: [Table, TaskList, Strikethrough, GFM] 
        }),
        EditorView.lineWrapping,
        modeCompartment.current.of([
          collapseOnSelectionFacet.of(isPreviewMode),
          mouseSelectingField,
          livePreviewPlugin,
          markdownStylePlugin,
          mathPlugin,
          blockMathField,
          tableField,
          codeBlockField(),
          imageField(),
          linkPlugin({
            openInNewTab: true,
          }),
          mermaidField(),
        ]),
        editorTheme,
        themeCompartment.current.of(currentTheme),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            onContentChange(content);
          }
        }),
        // Custom theme overrides
        EditorView.theme({
          ".cm-content": {
            padding: "16px 0",
          },
          ".cm-line": {
            padding: "0 24px",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    setupMouseSelecting(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [file.id, mounted, onContentChange]);

  // Update theme when it changes
  useEffect(() => {
    if (!viewRef.current || !mounted) return;

    const currentTheme = theme === "dark" ? vscodeDark : eclipse;
    viewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure(currentTheme),
    });
    
    // Update mermaid diagrams with new theme
    updateMermaidDiagrams(viewRef.current);
  }, [theme, mounted]);

  // Update preview mode when it changes (like the demo)
  useEffect(() => {
    if (!viewRef.current || !mounted) return;

    viewRef.current.dispatch({
      effects: modeCompartment.current.reconfigure(
        isPreviewMode ? [
          collapseOnSelectionFacet.of(true),
          mouseSelectingField,
          livePreviewPlugin,
          markdownStylePlugin,
          mathPlugin,
          blockMathField,
          tableField,
          codeBlockField(),
          imageField(),
          linkPlugin({
            openInNewTab: true,
          }),
          mermaidField(),
        ] : [
          collapseOnSelectionFacet.of(false),
          markdownStylePlugin,
        ]
      ),
    });
  }, [isPreviewMode, mounted]);

  const togglePreviewMode = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  // Update content when file changes
  useEffect(() => {
    if (!viewRef.current) return;
    
    const currentContent = viewRef.current.state.doc.toString();
    if (currentContent !== file.content) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: file.content,
        },
      });
    }
  }, [file.content]);

  return (
    <div className="h-full w-full flex flex-col obsidian-editor">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border bg-muted/20">
        <Button
          size="sm"
          variant={isPreviewMode ? "default" : "outline"}
          onClick={togglePreviewMode}
          className="gap-2 h-8"
          title={isPreviewMode ? "Switch to Source Mode" : "Switch to Live Preview"}
        >
          {isPreviewMode ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              Live Preview
            </>
          ) : (
            <>
              <Code2 className="h-3.5 w-3.5" />
              Source Mode
            </>
          )}
        </Button>
      </div>
      <div ref={editorRef} className="flex-1 overflow-auto pl-4 pr-4" />
    </div>
  );
}

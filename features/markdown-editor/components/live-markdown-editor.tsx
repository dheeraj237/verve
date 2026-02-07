"use client";

import { useEffect, useRef, useState } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment, Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Table, TaskList, GFM, Strikethrough } from "@lezer/markdown";
import {
  livePreviewPlugin,
  markdownStylePlugin,
  imageField,
  collapseOnSelectionFacet,
  mouseSelectingField,
  setMouseSelecting,
  editorTheme,
  mathPlugin,
  blockMathField,
  tableField,
  codeBlockField,
} from "codemirror-live-markdown";
import { useTheme } from "next-themes";
import { MarkdownFile } from "@/shared/types";
import { Eye, Code2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { getAppTheme, appSyntaxHighlighting, appSyntaxHighlightingDark } from "./editor-theme";
import { listPlugin } from "../plugins/list-plugin";
import { horizontalRulePlugin } from "../plugins/horizontal-rule-plugin";
import { mermaidPlugin } from "../plugins/mermaid-plugin";
import { codeBlockPlugin } from "../plugins/code-block-plugin";
import { customLinkPlugin } from "../plugins/custom-link-plugin";
import { htmlPlugin } from "../plugins/html-plugin";

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
  const scrollPosRef = useRef<number>(0);
  const currentFileIdRef = useRef<string>("");
  const isExternalUpdateRef = useRef<boolean>(false);

  function editorPlugins(isPreviewMode: boolean): Extension[] {
    return [
      collapseOnSelectionFacet.of(isPreviewMode),
      mouseSelectingField,
      livePreviewPlugin,
      markdownStylePlugin,
      mathPlugin,
      blockMathField,
      tableField,
      imageField(),
      customLinkPlugin,
      listPlugin,
      horizontalRulePlugin,
      htmlPlugin,
      // codeBlockField()
      mermaidPlugin,
      codeBlockPlugin,
    ]
  }

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

      const isDark = theme === "dark";
      const currentTheme = getAppTheme(isDark);
      const syntaxHighlighting = isDark ? appSyntaxHighlightingDark : appSyntaxHighlighting;

      // Track current file ID
      currentFileIdRef.current = file.id;

    const state = EditorState.create({
      doc: file.content,
      extensions: [
        history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        markdown({ 
          base: markdownLanguage, 
          extensions: [Table, TaskList, Strikethrough, GFM] 
        }),
        EditorView.lineWrapping,
        modeCompartment.current.of(editorPlugins(isPreviewMode)),
        editorTheme,
          syntaxHighlighting,
        themeCompartment.current.of(currentTheme),
        EditorView.updateListener.of((update) => {
            // Track scroll position on every update
            if (update.view) {
                scrollPosRef.current = update.view.scrollDOM.scrollTop;
            }

          if (update.docChanged) {
            const content = update.state.doc.toString();
              // Notify parent of content change - parent will handle save
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
    
    // Keep focus in editor when interacting with it
    const editorDom = view.dom;
    editorDom.addEventListener('mousedown', (e) => {
      // Prevent losing focus when clicking inside editor
      if (e.target instanceof HTMLElement && editorDom.contains(e.target)) {
        setTimeout(() => view.focus(), 0);
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [file.id, mounted, onContentChange]);

  // Update theme when it changes
  useEffect(() => {
    if (!viewRef.current || !mounted) return;

      const isDark = theme === "dark";
      const currentTheme = getAppTheme(isDark);
      const syntaxHighlighting = isDark ? appSyntaxHighlightingDark : appSyntaxHighlighting;

    viewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure(currentTheme),
    });
  }, [theme, mounted]);

  // Update preview mode when it changes (like the demo)
  useEffect(() => {
    if (!viewRef.current || !mounted) return;

    viewRef.current.dispatch({
      effects: modeCompartment.current.reconfigure(
        isPreviewMode ? editorPlugins(isPreviewMode) : [
          collapseOnSelectionFacet.of(false),
            markdownStylePlugin
        ]
      ),
    });
  }, [isPreviewMode, mounted]);

  const togglePreviewMode = () => {
      setIsPreviewMode(!isPreviewMode)
  };

    // Handle file changes: both switching files and external updates
  useEffect(() => {
      if (!viewRef.current || !mounted) return;
    
    const currentContent = viewRef.current.state.doc.toString();
      const isFileSwitched = file.id !== currentFileIdRef.current;
      const isExternalUpdate = (file as any).isExternalUpdate === true;

      // Scenario 1: Switching to a different file
      if (isFileSwitched) {
          currentFileIdRef.current = file.id;

          if (currentContent !== file.content) {
              viewRef.current.dispatch({
                  changes: {
                      from: 0,
                      to: currentContent.length,
                      insert: file.content,
                  },
              });

              // Scroll to top for new files
              setTimeout(() => {
                  if (viewRef.current) {
                      viewRef.current.scrollDOM.scrollTop = 0;
                  }
              }, 0);
          }
          return;
      }

      // Scenario 2: External file update (file modified outside editor)
      if (isExternalUpdate && currentContent !== file.content) {
          // Save current scroll position
          const savedScrollPos = viewRef.current.scrollDOM.scrollTop;

          // Update content seamlessly
      viewRef.current.dispatch({
          changes: {
              from: 0,
              to: currentContent.length,
              insert: file.content,
          },
      });

          // Preserve scroll position for external updates
      setTimeout(() => {
          if (viewRef.current) {
              viewRef.current.scrollDOM.scrollTop = savedScrollPos;
          }
      }, 0);

          // Clear the external update flag
          delete (file as any).isExternalUpdate;
      }

      // Scenario 3: Internal save (file.content updated from store after save)
      // Do nothing - editor is source of truth
  }, [file.id, file.content, (file as any).isExternalUpdate, mounted]);

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


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
import { getAppTheme, appSyntaxHighlighting, appSyntaxHighlightingDark } from "./editor-theme";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { listPlugin } from "../plugins/list-plugin";
import { horizontalRulePlugin } from "../plugins/horizontal-rule-plugin";
import { mermaidPlugin } from "../plugins/mermaid-plugin";
import { codeBlockPlugin } from "../plugins/code-block-plugin";
import { customLinkPlugin } from "../plugins/custom-link-plugin";
import { htmlPlugin } from "../plugins/html-plugin";
import { detailsPlugin } from "../plugins/details-plugin";
import { useTocStore } from "@/features/editor/store/toc-store";
import { useTableOfContents } from "@/features/editor/hooks/use-table-of-contents";

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
  // Always show live preview in markdown editor
  const isPreviewMode = true;
  const themeCompartment = useRef(new Compartment());
  const modeCompartment = useRef(new Compartment());
  const scrollPosRef = useRef<number>(0);
  const currentFileIdRef = useRef<string>("");
  const isExternalUpdateRef = useRef<boolean>(false);
  const [editorContent, setEditorContent] = useState(file.content);

  // TOC integration
  const { setItems, setActiveId, isManualSelection } = useTocStore();
  const headings = useTableOfContents(editorContent);
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  // Ensure editorContent is synced with file.content on file change
  useEffect(() => {
    setEditorContent(file.content);
  }, [file.id, file.content]);

  // Update TOC when headings change
  useEffect(() => {
    setItems(headings);
  }, [headings, setItems]);

  // Track active heading based on scroll position (matches preview mode behavior)
  useEffect(() => {
    if (!editorView || !mounted) return;

    const view = editorView;
    let ticking = false;

    const updateActiveHeading = () => {
      if (headings.length === 0) {
        ticking = false;
        return;
      }

      const doc = view.state.doc;
      const scrollTop = view.scrollDOM.scrollTop;
      const thresholdOffset = 150;
      const lineAtThreshold = view.lineBlockAtHeight(scrollTop + thresholdOffset);
      const currentLine = doc.lineAt(lineAtThreshold.from).number;

      // Find the active heading: last heading before or at the threshold line
      let activeHeading = headings[0]?.id || '';
      for (let i = headings.length - 1; i >= 0; i--) {
        if (headings[i].line <= currentLine) {
          activeHeading = headings[i].id;
          break;
        }
      }

      if (!isManualSelection) {
        setActiveId(activeHeading);
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveHeading();
        });
        ticking = true;
      }
    };

    // Initial update to set first heading active
    updateActiveHeading();

    view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      view.scrollDOM.removeEventListener('scroll', handleScroll);
    };
  }, [editorView, headings, mounted, setActiveId, isManualSelection]);

  // Handle TOC item clicks
  useEffect(() => {
    if (!editorView || !mounted) return;

    const handleTocClick = (event: Event) => {
      const customEvent = event as CustomEvent;
      const headingId = customEvent.detail?.headingId;

      const heading = headings.find(h => h.id === headingId);
      if (!heading || !editorView) return;

      const view = editorView;
      const doc = view.state.doc;

      if (heading.line > 0 && heading.line <= doc.lines) {
        const lineInfo = doc.line(heading.line);
        const pos = lineInfo.from;

        view.dispatch({
          effects: EditorView.scrollIntoView(pos, {
            y: "start",
            yMargin: 80
          })
        });

        view.focus();
      }
    };

    window.addEventListener('toc-click', handleTocClick);

    return () => {
      window.removeEventListener('toc-click', handleTocClick);
    };
  }, [editorView, headings, mounted]);

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
      codeBlockPlugin,
      mermaidPlugin,
      htmlPlugin,
      detailsPlugin,
    ];
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set current file path for link navigation plugin
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__currentFilePath = file.path;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__currentFilePath;
      }
    };
  }, [file.path]);

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
            // Update local content for TOC extraction
            setEditorContent(content);
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
    setEditorContent(file.content);

    setTimeout(() => {
      setEditorView(view);
    }, 0);

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
      setEditorView(null);
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

    // Handle file changes: both switching files and external updates
  useEffect(() => {
      if (!viewRef.current || !mounted) return;
    
    const currentContent = viewRef.current.state.doc.toString();
      const isFileSwitched = file.id !== currentFileIdRef.current;
      const isExternalUpdate = (file as any).isExternalUpdate === true;

      // Scenario 1: Switching to a different file
      if (isFileSwitched) {
          currentFileIdRef.current = file.id;
        setEditorContent(file.content);

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

        setEditorContent(file.content);
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
      <div ref={editorRef} className="flex-1 overflow-y-auto pl-2 overflow-x-hidden mb-10 pb-5" />
    </div>
  );
}


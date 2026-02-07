"use client";

import { useState, memo, ReactNode, useEffect } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { useTheme } from "next-themes";

interface CodeBlockProps {
  children: ReactNode;
  language?: string;
}

/**
 * Get language support for syntax highlighting
 */
function getLanguageSupport(lang: string) {
  const langLower = (lang || '').toLowerCase();

  switch (langLower) {
    case 'javascript':
    case 'js':
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    case 'python':
    case 'py':
      return python();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    case 'html':
    case 'xml':
      return html();
    case 'json':
      return json();
    case 'sql':
      return sql();
    case 'markdown':
    case 'md':
      return markdown();
    default:
      return null;
  }
}

/**
 * Syntax highlighting style that matches the app theme
 */
const lightSyntaxHighlight = HighlightStyle.define([
  { tag: tags.comment, color: 'hsl(218, 11%, 65%)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'hsl(221.2, 83.2%, 53.3%)', fontWeight: '600' },
  { tag: tags.string, color: 'hsl(142, 76%, 36%)' },
  { tag: tags.number, color: 'hsl(24, 100%, 50%)' },
  { tag: tags.function(tags.variableName), color: 'hsl(221.2, 83.2%, 53.3%)', fontWeight: '500' },
  { tag: tags.variableName, color: 'hsl(222.2, 47.4%, 11.2%)' },
  { tag: tags.typeName, color: 'hsl(280, 100%, 60%)' },
  { tag: tags.className, color: 'hsl(280, 100%, 60%)' },
  { tag: tags.operator, color: 'hsl(222.2, 47.4%, 11.2%)' },
  { tag: tags.propertyName, color: 'hsl(211, 100%, 45%)' },
]);

const darkSyntaxHighlight = HighlightStyle.define([
  { tag: tags.comment, color: 'hsl(218, 11%, 65%)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'hsl(211, 100%, 80%)', fontWeight: '600' },
  { tag: tags.string, color: 'hsl(142, 76%, 56%)' },
  { tag: tags.number, color: 'hsl(24, 100%, 65%)' },
  { tag: tags.function(tags.variableName), color: 'hsl(211, 100%, 80%)', fontWeight: '500' },
  { tag: tags.variableName, color: 'hsl(220, 14%, 91%)' },
  { tag: tags.typeName, color: 'hsl(280, 100%, 75%)' },
  { tag: tags.className, color: 'hsl(280, 100%, 75%)' },
  { tag: tags.operator, color: 'hsl(220, 14%, 91%)' },
  { tag: tags.propertyName, color: 'hsl(211, 100%, 70%)' },
]);

function CodeBlockComponent({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [editorContainer, setEditorContainer] = useState<HTMLDivElement | null>(null);
  const { theme } = useTheme();

  // Extract plain text for copying
  const getTextContent = (node: ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getTextContent).join('');
    if (node && typeof node === 'object' && 'props' in node) {
      return getTextContent((node as any).props.children);
    }
    return '';
  };

  const codeText = getTextContent(children);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Setup CodeMirror for syntax highlighting
  useEffect(() => {
    if (!editorContainer || !codeText) return;

    const langSupport = getLanguageSupport(language || '');
    const extensions = [
      EditorView.editable.of(false),
      EditorView.lineWrapping,
    ];

    // Add language support if available
    if (langSupport) {
      extensions.push(langSupport);
    }

    // Add syntax highlighting
    const isDark = theme === 'dark';
    extensions.push(syntaxHighlighting(isDark ? darkSyntaxHighlight : lightSyntaxHighlight));

    // Create read-only editor for highlighting
    const view = new EditorView({
      state: EditorState.create({
        doc: codeText,
        extensions,
      }),
      parent: editorContainer,
    });

    return () => {
      view.destroy();
    };
  }, [editorContainer, codeText, language, theme]);

  return (
    <div className="group relative my-6 rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-mono text-muted-foreground uppercase">
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
            "hover:bg-muted-foreground/10",
            copied ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
          )}
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with CodeMirror */}
      <div className="overflow-x-auto">
        <div
          ref={setEditorContainer}
          className="codemirror-preview-wrapper"
        />
      </div>
    </div>
  );
}

// Memoize to prevent re-renders
export const CodeBlock = memo(CodeBlockComponent);

CodeBlock.displayName = 'CodeBlock';

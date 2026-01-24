"use client";

import { useState, memo, ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface CodeBlockProps {
  children: ReactNode;
  language?: string;
}

function CodeBlockComponent({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    const text = getTextContent(children);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
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

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="p-4 m-0 text-sm leading-relaxed bg-transparent">
          <code className={cn("font-mono", language && `language-${language}`)}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Memoize to prevent re-renders
export const CodeBlock = memo(CodeBlockComponent);

CodeBlock.displayName = 'CodeBlock';

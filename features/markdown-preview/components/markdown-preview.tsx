"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { FileText } from "lucide-react";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { useEffect, useRef, useMemo, memo } from "react";
import { useTocStore } from "../store/toc-store";
import { useTableOfContents } from "../hooks/use-table-of-contents";
import { useActiveHeading } from "../hooks/use-active-heading";
import { MermaidDiagram } from "./mermaid-diagram";
import { CodeBlock } from "./code-block";
import { sanitizeMarkdown } from "@/shared/utils/sanitize";

const MarkdownContent = memo(({ content, headings }: { content: string; headings: any[] }) => {
  // Memoize markdown components to prevent re-renders
  const components = useMemo(() => ({
    h1: ({ node, children, ...props }: any) => {
      const text = String(children);
      const index = headings.findIndex(h => h.text === text && h.level === 1);
      const id = index >= 0 ? headings[index].id : undefined;
      return <h1 id={id} className="text-3xl font-semibold mt-0 mb-6 tracking-tight" {...props}>{children}</h1>;
    },
    h2: ({ node, children, ...props }: any) => {
      const text = String(children);
      const index = headings.findIndex(h => h.text === text && h.level === 2);
      const id = index >= 0 ? headings[index].id : undefined;
      return <h2 id={id} className="text-2xl font-semibold mt-10 mb-4 pb-2 border-b border-border tracking-tight" {...props}>{children}</h2>;
    },
    h3: ({ node, children, ...props }: any) => {
      const text = String(children);
      const index = headings.findIndex(h => h.text === text && h.level === 3);
      const id = index >= 0 ? headings[index].id : undefined;
      return <h3 id={id} className="text-xl font-semibold mt-8 mb-3 tracking-tight" {...props}>{children}</h3>;
    },
    h4: ({ node, children, ...props }: any) => {
      const text = String(children);
      const index = headings.findIndex(h => h.text === text && h.level === 4);
      const id = index >= 0 ? headings[index].id : undefined;
      return <h4 id={id} className="text-lg font-semibold mt-6 mb-2 tracking-tight" {...props}>{children}</h4>;
    },
    h5: ({ node, children, ...props }: any) => {
      const text = String(children);
      const index = headings.findIndex(h => h.text === text && h.level === 5);
      const id = index >= 0 ? headings[index].id : undefined;
      return <h5 id={id} className="text-base font-semibold mt-4 mb-2 tracking-tight" {...props}>{children}</h5>;
    },
    h6: ({ node, children, ...props }: any) => {
      const text = String(children);
      const index = headings.findIndex(h => h.text === text && h.level === 6);
      const id = index >= 0 ? headings[index].id : undefined;
      return <h6 id={id} className="text-sm font-semibold mt-4 mb-2 tracking-tight" {...props}>{children}</h6>;
    },
    a: ({ href, children }: any) => (
      <a
        href={href}
        className="text-primary hover:underline font-medium cursor-pointer"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    ),
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      // Inline code - single backticks (no language class or explicitly inline)
      if (inline || (!className && !language)) {
        return (
          <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-[0.9em] font-mono text-amber-700" {...props}>
            {children}
          </code>
        );
      }

      // Check if it's a mermaid diagram
      if (language === 'mermaid') {
        // Extract text content
        const getTextContent = (child: any): string => {
          if (typeof child === 'string') return child;
          if (Array.isArray(child)) return child.map(getTextContent).join('');
          if (child?.props?.children) return getTextContent(child.props.children);
          return '';
        };

        const codeString = getTextContent(children);
        return <MermaidDiagram code={codeString.trim()} />;
      }

      // Code block with proper UI and syntax highlighting (triple backticks with language)
      const codeString = String(children).replace(/\n$/, '');
      return (
        <CodeBlock language={language}>
          {children}
        </CodeBlock>
      );
    },
    ul: ({ children }: any) => (
      <ul className="list-disc pl-6 my-4 space-y-1">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal pl-6 my-4 space-y-1">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="leading-7">{children}</li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-primary bg-muted/50 pl-4 py-2 my-4 italic">
        {children}
      </blockquote>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-border">
          {children}
        </table>
      </div>
    ),
    hr: () => <hr className="my-8 border-border" />,
  }), [headings]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypePrism as any]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

interface MarkdownPreviewProps {
  content?: string;
}

export function MarkdownPreview({ content: propContent }: MarkdownPreviewProps = {}) {
  const { setItems, setActiveId } = useTocStore();
  const rawContent = propContent || "";

  // Sanitize content before processing
  const content = useMemo(() => sanitizeMarkdown(rawContent), [rawContent]);

  const headings = useTableOfContents(content);
  const activeId = useActiveHeading(headings.map(h => h.id));

  // Update TOC store when headings change
  useEffect(() => {
    setItems(headings);
  }, [headings, setItems]);

  // Update active heading in store
  useEffect(() => {
    setActiveId(activeId);
  }, [activeId, setActiveId]);

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <FileText className="h-24 w-24 text-muted-foreground mb-6" />
        <h2 className="text-xl font-semibold mb-2">No content to preview</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Select a markdown file from the explorer to view its contents
        </p>
      </div>
    );
  }

  return (
    <article className="markdown-body prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-3xl prose-h1:mt-0 prose-h1:mb-6 prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-2 prose-p:leading-7 prose-p:mb-4 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:not-italic prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-4 prose-th:py-2 prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2 prose-hr:border-border prose-img:rounded-lg prose-img:shadow-sm">
      <MarkdownContent content={content} headings={headings} />
    </article>
  );
}

import { useState, useEffect } from "react";

export interface TocItem {
  id: string;
  text: string;
  level: number;
  line: number; // Line number in the document (1-based)
}

export function useTableOfContents(content: string) {
  const [headings, setHeadings] = useState<TocItem[]>([]);

  useEffect(() => {
    const lines = content.split('\n');
    const tocItems: TocItem[] = [];
    let inCodeBlock = false;

    // Parse headings from markdown content, tracking line numbers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track code blocks to skip headings inside them
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (inCodeBlock) continue;

      // Match heading pattern: # Heading
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = `heading-${text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-${tocItems.length}`;

        tocItems.push({
          id,
          text,
          level,
          line: i + 1 // 1-based line number
        });
      }
    }
    
    setHeadings(tocItems);
  }, [content]);

  return headings;
}

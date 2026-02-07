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
    const usedIds = new Map<string, number>();
    let inCodeBlock = false;

    // Helper function to generate standard markdown anchor IDs
    const generateId = (text: string): string => {
      // Convert to lowercase and replace spaces/special chars with hyphens
      // This matches GitHub's heading anchor format
      let slug = text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/-+/g, '-')      // Replace multiple hyphens with single
        .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens

      // Handle duplicate headings by appending a counter
      if (usedIds.has(slug)) {
        const count = usedIds.get(slug)! + 1;
        usedIds.set(slug, count);
        return `${slug}-${count}`;
      } else {
        usedIds.set(slug, 0);
        return slug;
      }
    };

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
        const id = generateId(text);

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

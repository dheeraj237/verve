import { useState, useEffect } from "react";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function useTableOfContents(content: string) {
  const [headings, setHeadings] = useState<TocItem[]>([]);

  useEffect(() => {
    // Parse headings from markdown content
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const matches = Array.from(content.matchAll(headingRegex));
    
    const tocItems = matches.map((match, index) => {
      const level = match[1].length;
      const text = match[2].trim();
      // Create a slug-like id from the heading text
      const id = `heading-${text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-${index}`;
      
      return { id, text, level };
    });
    
    setHeadings(tocItems);
  }, [content]);

  return headings;
}

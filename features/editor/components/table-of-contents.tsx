"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/shared/utils/cn";
import { useTocStore } from "../store/toc-store";
import { TocItem } from "../hooks/use-table-of-contents";
import { scrollToHeading } from "@/shared/utils/scroll-to-heading";

interface TableOfContentsProps {
  items: TocItem[];
  activeId: string;
}

export function TableOfContents({ items, activeId }: TableOfContentsProps) {
  const activeItemRef = useRef<HTMLAnchorElement>(null);
  const { setManualActiveId, clearManualSelection } = useTocStore();
  
  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();

    // Set manual selection to prevent auto-detection from overriding
    setManualActiveId(id);

    // Use shared scroll utility
    scrollToHeading(id);

    // Clear manual selection after scroll animation completes (500ms)
    setTimeout(() => {
      clearManualSelection();
    }, 500);
  };

  // Auto-scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeId]);

  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-background shrink-0">
          <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wide">
            Table of Contents
          </h3>
        </div>
        <div className="flex-1 p-4">
          <p className="text-sm text-muted-foreground">
            No headings found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-background shrink-0">
        <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wide">
          Table of Contents
        </h3>
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        <ul className="space-y-0">
          {items.map((item) => {
            const isActive = activeId === item.id;
            const paddingLeft = (item.level - 1) * 16;
            
            return (
              <li key={item.id}>
                <a
                  ref={isActive ? activeItemRef : null}
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  style={{ paddingLeft: `${paddingLeft + 16}px` }}
                  className={cn(
                    "block py-1.5 pr-4 text-sm transition-colors duration-200",
                    "hover:text-primary",
                    "border-l-2 border-transparent",
                    isActive
                      ? "text-primary font-bold border-l-primary bg-primary/5 underline"
                      : "text-sidebar-foreground hover:border-l-sidebar-border"
                  )}
                  title={item.text}
                >
                  <span className="line-clamp-2">{item.text}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

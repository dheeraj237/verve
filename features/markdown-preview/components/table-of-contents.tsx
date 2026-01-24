"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/shared/utils/cn";
import { useTocStore } from "../store/toc-store";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

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

    const element = document.getElementById(id);
    const container = document.getElementById("markdown-content");
    if (element && container) {
      const elementTop = element.offsetTop;
      const containerHeight = container.clientHeight;
      const contentHeight = container.scrollHeight;
      
      // Calculate if we can scroll to top
      const maxScroll = contentHeight - containerHeight;
      const targetScroll = elementTop - 80;
      
      if (targetScroll <= maxScroll) {
        container.scrollTo({
          top: targetScroll,
          behavior: "smooth"
        });
      } else {
        container.scrollTo({
          top: maxScroll,
          behavior: "smooth"
        });
      }

        // Clear manual selection after scroll animation completes (500ms)
        setTimeout(() => {
            clearManualSelection();
        }, 500);
    }
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
        <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-background">
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
      <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-background">
        <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wide">
          Table of Contents
        </h3>
      </div>
      <nav className="flex-1 overflow-auto py-4">
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
                      ? "text-primary font-bold border-l-primary bg-primary/5"
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

import { useState, useEffect } from "react";
import { useTocStore } from "../store/toc-store";

export function useActiveHeading(headingIds: string[]) {
  const [activeId, setActiveId] = useState<string>("");
  const isManualSelection = useTocStore((state) => state.isManualSelection);

  useEffect(() => {
    if (headingIds.length === 0) return;

    const container = document.getElementById("markdown-content");
    if (!container) return;

    let ticking = false;

    const updateActiveHeading = () => {
      const scrollTop = container.scrollTop;
      const containerTop = container.getBoundingClientRect().top;
      
      // Find headings with their positions
      const headingElements = headingIds
        .map(id => {
          const element = document.getElementById(id);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            id,
            top: rect.top - containerTop + scrollTop,
            offsetTop: rect.top - containerTop
          };
        })
        .filter(Boolean) as Array<{ id: string; top: number; offsetTop: number }>;

      // Find the heading that should be active
      // Active heading is the last one that's scrolled past the threshold (150px from top)
      let newActiveId = headingIds[0];
      
      for (let i = headingElements.length - 1; i >= 0; i--) {
        const heading = headingElements[i];
        if (heading.offsetTop <= 150) {
          newActiveId = heading.id;
          break;
        }
      }

      // Don't update if user manually selected a heading
      if (!isManualSelection) {
        setActiveId(newActiveId);
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

    // Initial update
    updateActiveHeading();

    // Listen to scroll with throttling
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [headingIds, isManualSelection]);

  return activeId;
}

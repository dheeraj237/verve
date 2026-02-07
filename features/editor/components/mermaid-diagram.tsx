"use client";

import { useEffect, useRef, useState, memo } from "react";

interface MermaidDiagramProps {
  code: string;
}

function MermaidDiagramComponent({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>("");
  const hasRenderedRef = useRef(false);
  const instanceIdRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Only render once per instance - prevent re-renders on scroll
    if (hasRenderedRef.current) {
      return;
    }

    const renderDiagram = async () => {
      if (!containerRef.current || !code) return;

      try {
        // Dynamically import mermaid
        const mermaid = (await import("mermaid")).default;

        // Initialize mermaid with configuration
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
          fontFamily: "inherit",
        });

        // Use consistent ID for this instance
        const id = instanceIdRef.current;
        
        // Render the diagram
        const { svg } = await mermaid.render(id, code);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          hasRenderedRef.current = true;
          setError("");
        }
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      }
    };

    renderDiagram();
  }, []); // Empty dependency array - only run once per mount

  if (error) {
    return (
      <div className="border border-destructive bg-destructive/10 rounded-lg p-4 my-4">
        <p className="text-sm text-destructive font-medium mb-2">
          Failed to render Mermaid diagram
        </p>
        <pre className="text-xs text-muted-foreground overflow-auto">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram flex justify-center items-center my-6 p-4 bg-muted/30 rounded-lg border border-border overflow-auto"
    />
  );
}

// Memoize with custom comparison to prevent re-renders
export const MermaidDiagram = memo(MermaidDiagramComponent, (prevProps, nextProps) => {
  // Always return true to prevent re-renders after initial mount
  return true;
});

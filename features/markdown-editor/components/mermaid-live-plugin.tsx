"use client";

import { StateField, StateEffect, EditorState } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import mermaid from "mermaid";

// Initialize mermaid
if (typeof window !== "undefined") {
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: "inherit",
  });
}

// Effect to trigger diagram updates
const updateMermaidEffect = StateEffect.define<null>();

class MermaidWidget extends WidgetType {
  private id: string;
  private renderPromise: Promise<{ svg: string }> | null = null;

  constructor(readonly code: string, readonly isDark: boolean) {
    super();
    this.id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
  }

  eq(other: MermaidWidget) {
    return this.code === other.code && this.isDark === other.isDark;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-mermaid-diagram";
    wrap.style.cssText = `
      margin: 1em 0;
      padding: 1em;
      background: ${this.isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)"};
      border-radius: 8px;
      overflow-x: auto;
    `;

    const container = document.createElement("div");
    container.className = "mermaid-container";
    container.style.cssText = `
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100px;
    `;

    wrap.appendChild(container);

    // Render mermaid diagram
    this.renderDiagram(container);

    return wrap;
  }

  async renderDiagram(container: HTMLElement) {
    try {
      // Update theme based on isDark
      mermaid.initialize({
        startOnLoad: false,
        theme: this.isDark ? "dark" : "default",
        securityLevel: "loose",
        fontFamily: "inherit",
      });

      container.innerHTML = '<div style="color: hsl(var(--muted-foreground)); font-size: 0.875rem;">Rendering diagram...</div>';

      // Render the diagram
      const { svg } = await mermaid.render(this.id, this.code);
      
      container.innerHTML = svg;
      
      // Style the SVG
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        svgElement.style.maxWidth = "100%";
        svgElement.style.height = "auto";
      }
    } catch (error) {
      console.error("Mermaid rendering error:", error);
      container.innerHTML = `
        <div style="color: hsl(var(--destructive)); font-size: 0.875rem; padding: 1em; background: hsl(var(--destructive) / 0.1); border-radius: 4px;">
          <strong>Mermaid Error:</strong><br/>
          ${error instanceof Error ? error.message : "Failed to render diagram"}
        </div>
      `;
    }
  }

  ignoreEvent() {
    return true;
  }
}

function buildMermaidDecorations(state: EditorState): DecorationSet {
  const decorations: any[] = [];
  const tree = syntaxTree(state);
  const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");

  // Find mermaid code blocks
  tree.iterate({
    enter: (node) => {
      // Look for FencedCode nodes
      if (node.name === "FencedCode") {
        const from = node.from;
        const to = node.to;
        const text = state.doc.sliceString(from, to);
        
        // Check if it's a mermaid block
        const match = text.match(/^```mermaid\n([\s\S]*?)\n```$/);
        if (match) {
          const code = match[1].trim();
          
          if (code) {
            // Add decoration to replace the code block with rendered diagram
            decorations.push(
              Decoration.replace({
                widget: new MermaidWidget(code, isDark),
                block: true,
              }).range(from, to)
            );
          }
        }
      }
    },
  });

  return Decoration.set(decorations, true);
}

export const mermaidField = () => {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildMermaidDecorations(state);
    },

    update(decorations, tr) {
      // Rebuild decorations on document changes or when mermaid effect is dispatched
      if (tr.docChanged || tr.effects.some(e => e.is(updateMermaidEffect))) {
        return buildMermaidDecorations(tr.state);
      }
      
      // Map decorations through changes
      return decorations.map(tr.changes);
    },

    provide(field) {
      return EditorView.decorations.from(field);
    },
  });
};

// Helper to trigger mermaid updates (e.g., on theme change)
export function updateMermaidDiagrams(view: EditorView) {
  view.dispatch({
    effects: updateMermaidEffect.of(null),
  });
}

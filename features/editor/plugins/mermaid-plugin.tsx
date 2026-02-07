/**
 * Mermaid Plugin - Renders ```mermaid code blocks as interactive diagrams
 * Dynamically imports mermaid library to reduce bundle size
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { shouldShowWidgetSourceState } from './plugin-utils';

// Counter for unique diagram IDs - prevents mermaid rendering conflicts
let mermaidCounter = 0;

/**
 * Widget that replaces mermaid code block with rendered diagram
 * Async rendering happens after DOM insertion to avoid blocking
 */
class MermaidWidget extends WidgetType {
  constructor(private code: string, private id: string) {
    super();
  }

  // Only re-render if code content changed (optimization)
  eq(other: MermaidWidget) {
    return other instanceof MermaidWidget && this.code === other.code;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-mermaid-diagram";

    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--muted-foreground);">Loading diagram...</div>';

    // Async rendering to avoid blocking main thread
    this.renderMermaid(container, this.code, this.id);

    return container;
  }

  async renderMermaid(container: HTMLElement, code: string, id: string) {
    try {
      // Dynamic import: only load mermaid when needed (reduces initial bundle)
      const mermaid = (await import("mermaid")).default;

      // Sync theme with next-themes (dark class on html element)
      const htmlEl = document.documentElement;
      const isDark = htmlEl.classList.contains('dark');
      const theme = isDark ? "dark" : "default";

      mermaid.initialize({
        startOnLoad: false,
        theme: theme,
        securityLevel: "strict", // Strict security: prevents arbitrary JS execution
        fontFamily: "inherit",
        flowchart: {
          useMaxWidth: true, // Responsive diagrams
        },
      });

      // Render the diagram
      const { svg } = await mermaid.render(id, code);
      container.innerHTML = svg;
    } catch (err) {
      console.error("Mermaid rendering error:", err);
      container.innerHTML = `
        <div style="padding: 1rem; background: hsl(var(--destructive) / 0.1); border: 1px solid hsl(var(--destructive) / 0.3); border-radius: 0.375rem; color: hsl(var(--destructive));">
          <strong>Failed to render Mermaid diagram:</strong>
          <pre style="margin-top: 0.5rem; font-size: 0.75rem; white-space: pre-wrap;">${err instanceof Error ? err.message : "Unknown error"}</pre>
        </div>
      `;
    }
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Build decorations: Find all ```mermaid blocks and replace with widgets
 * Skips blocks where cursor/selection is present (shows source instead)
 */
function buildMermaidDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'FencedCode') {
        // Extract language from code info line (```mermaid)
        const codeInfo = node.node.getChild('CodeInfo');
        if (!codeInfo) return;

        const language = state.doc.sliceString(codeInfo.from, codeInfo.to).trim().toLowerCase();

        if (language !== 'mermaid') return;

        // Get actual code content (between opening and closing ```)
        const codeText = node.node.getChild('CodeText');
        const code = codeText
          ? state.doc.sliceString(codeText.from, codeText.to).trim()
          : '';

        if (!code) return;

        // Show source if cursor is inside or text is selected
        const shouldShowSource = shouldShowWidgetSourceState(state, node.from, node.to);

        if (!shouldShowSource) {
          const id = `mermaid-${node.from}-${mermaidCounter++}`;
          const widget = new MermaidWidget(code, id);

          decorations.push(
            Decoration.replace({ widget, block: true }).range(node.from, node.to)
          );
        }
      }
    },
  });

  return Decoration.set(decorations.sort((a, b) => a.from - b.from), true);
}

/**
 * StateField: Manages decoration lifecycle
 * Rebuilds decorations on document or selection changes
 */
const mermaidField = StateField.define<DecorationSet>({
  create(state) {
    return buildMermaidDecorations(state);
  },

  update(deco, tr) {
    // Rebuild on document changes or selection changes
    if (tr.docChanged || tr.reconfigured) {
      return buildMermaidDecorations(tr.state);
    }

    // Rebuild when selection changes to show/hide source
    if (tr.selection) {
      return buildMermaidDecorations(tr.state);
    }

    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Mermaid plugin
 * Renders mermaid diagrams in code blocks
 */
export const mermaidPlugin = mermaidField;

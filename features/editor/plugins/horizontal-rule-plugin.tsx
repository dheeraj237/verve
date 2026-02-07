/**
 * Horizontal rule plugin for CodeMirror to render markdown horizontal lines
 * Converts ---, ***, ___ into visual horizontal rules
 */

import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view';
import { shouldShowSource } from 'codemirror-live-markdown';

/**
 * Widget to render horizontal rule
 */
class HorizontalRuleWidget extends WidgetType {
  eq(other: HorizontalRuleWidget) {
    return true;
  }

  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-hr";
    return hr;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Check if a range overlaps with any selection
 */
function hasSelectionOverlap(view: EditorView, from: number, to: number): boolean {
  const { selection } = view.state;
  for (const range of selection.ranges) {
    if (range.from < to && range.to > from) {
      return true;
    }
  }
  return false;
}

/**
 * Build decorations for horizontal rules
 */
function buildHorizontalRuleDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const processedLines = new Set<number>();

  // Process each line in the viewport
  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === 'HorizontalRule') {
          const line = view.state.doc.lineAt(node.from);

          // Skip if already processed
          if (processedLines.has(line.number)) return;
          processedLines.add(line.number);

          const from = node.from;
          const to = node.to;

          // Trim whitespace to avoid touching next line
          let contentFrom = from;
          let contentTo = to;
          const doc = view.state.doc;
          while (contentFrom < contentTo && /\s/.test(doc.sliceString(contentFrom, contentFrom + 1))) {
            contentFrom++;
          }
          while (contentTo > contentFrom && /\s/.test(doc.sliceString(contentTo - 1, contentTo))) {
            contentTo--;
          }

          // Show raw source when caret is inside or selection overlaps the horizontal rule
          if (shouldShowSource(view.state, contentFrom, contentTo) ||
              hasSelectionOverlap(view, contentFrom, contentTo)) {
            return;
          }

          // Render mode: show widget
          const widget = new HorizontalRuleWidget();
          builder.add(
            contentFrom,
            contentTo,
            Decoration.replace({ widget })
          );
        }
      },
    });
  }

  return builder.finish();
}

/**
 * Horizontal rule plugin
 * Renders visual horizontal lines for markdown HR syntax
 */
export const horizontalRulePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildHorizontalRuleDecorations(view);
    }

    update(update: any) {
      // Rebuild on document, viewport, or selection changes
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildHorizontalRuleDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

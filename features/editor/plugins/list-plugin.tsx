/**
 * Custom list plugin for CodeMirror to render markdown lists, blockquotes, and task lists
 * This plugin adds:
 * - Visual bullets for unordered lists
 * - Checkboxes for task lists with interactive toggle
 * - Block quote borders
 */

import { ViewPlugin, EditorView, Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import { shouldShowSource } from "codemirror-live-markdown";

/**
 * Widget to replace list markers (-, *, +) with visual bullets
 * Simplified to use plain text without flex layout
 */
class BulletWidget extends WidgetType {
  constructor(private level: number, private marker: string) {
    super();
  }

  eq(other: BulletWidget) {
    return this.level === other.level && this.marker === other.marker;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.setAttribute("data-level", this.level.toString());
    span.setAttribute("aria-hidden", "true");

    // Different bullets for different levels
    const bullets = ["•", "◦", "▪"];
    span.textContent = bullets[Math.min(this.level - 1, 2)] + " "; // Add space after bullet

    return span;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Widget to render ordered list numbers
 * Simplified to use plain text
 */
class NumberWidget extends WidgetType {
  constructor(private number: number, private level: number) {
    super();
  }

  eq(other: NumberWidget) {
    return this.number === other.number && this.level === other.level;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-number";
    span.setAttribute("data-level", this.level.toString());
    span.setAttribute("aria-hidden", "true");
    span.textContent = `${this.number}. `; // Add space after number
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Widget to replace task list brackets with checkboxes
 * Simplified to use unicode checkbox characters instead of styled boxes
 */
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean, private pos: number) {
    super();
  }

  eq(other: CheckboxWidget) {
    return this.checked === other.checked;
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = "cm-task-checkbox";
    span.setAttribute("role", "checkbox");
    span.setAttribute("aria-checked", this.checked.toString());
    span.setAttribute("data-checked", this.checked.toString());
    span.setAttribute("tabindex", "0");

    // Use unicode checkbox characters for natural text flow
    // Checked: ☑ (U+2611), Unchecked: ☐ (U+2610)
    span.textContent = this.checked ? "☑ " : "☐ ";
    if (this.checked) {
      span.classList.add("cm-task-checkbox-checked");
    }

    // Make it clickable to toggle
    span.style.cursor = "pointer";

    // Handle click
    span.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleCheckbox(view, this.pos);
    };

    // Handle keyboard accessibility
    span.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleCheckbox(view, this.pos);
      }
    };

    return span;
  }

  toggleCheckbox(view: EditorView, pos: number) {
    // Find the task marker at this position and toggle it
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    
    // Match [ ] or [x] or [X]
    const match = text.match(/\[([ xX])\]/);
    if (match && match.index !== undefined) {
      const isChecked = match[1] !== ' ';
      const newChar = isChecked ? ' ' : 'x';
      const from = line.from + match.index + 1;
      const to = from + 1;
      
      view.dispatch({
        changes: { from, to, insert: newChar }
      });
    }
  }

  ignoreEvent(event: Event) {
    // Ignore click and keyboard events to allow widget's own handlers to work
    return event.type === 'mousedown' || event.type === 'keydown';
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
 * Build decorations for lists, blockquotes, and task lists
 */
function buildListDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  // Track lines that have been processed to avoid duplicate decorations
  const processedLines = new Set<number>();

  // Process each line in the viewport
  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const { from: nodeFrom, to: nodeTo, name } = node;

        // Handle ListItem nodes (both bullet and ordered lists)
        if (name === "ListItem") {
          const line = view.state.doc.lineAt(nodeFrom);

          // Skip if already processed
          if (processedLines.has(line.number)) return;
          processedLines.add(line.number);

          const lineText = line.text;

          // Check for task list first: - [ ] or - [x]
          const taskMatch = lineText.match(/^(\s*)([\-\*\+])\s+(\[([ xX])\])\s*/);
          if (taskMatch) {
            const leadingSpaces = taskMatch[1].length;
            const level = Math.floor(leadingSpaces / 2) + 1;
            const markerStart = line.from + taskMatch[1].length;
            const markerEnd = markerStart + 1; // Just the marker (-, *, +)
            const checkboxStart = line.from + taskMatch[1].length + taskMatch[2].length + 1; // After "- "
            const checkboxEnd = checkboxStart + 3; // "[x]" or "[ ]" length
            const isChecked = taskMatch[4] !== ' ';

            // Show raw source when caret is inside or selection overlaps the marker/checkbox
            if (shouldShowSource(view.state, markerStart, checkboxEnd) ||
                hasSelectionOverlap(view, markerStart, checkboxEnd)) {
              return;
            }

            // Hide the list marker
            builder.add(
              markerStart,
              markerEnd,
              Decoration.replace({})
            );

            // Replace checkbox with widget
            builder.add(
              checkboxStart,
              checkboxEnd,
              Decoration.replace({
                widget: new CheckboxWidget(isChecked, checkboxStart),
              })
            );
            return;
          }

          // Check for ordered list: 1. item
          const orderedMatch = lineText.match(/^(\s*)(\d+)\.\s+/);
          if (orderedMatch) {
            const leadingSpaces = orderedMatch[1].length;
            const level = Math.floor(leadingSpaces / 2) + 1;
            const markerStart = line.from + orderedMatch[1].length;
            const markerEnd = markerStart + orderedMatch[2].length + 1; // number and dot

            // Show raw source when caret is inside or selection overlaps
            if (shouldShowSource(view.state, markerStart, markerEnd) ||
                hasSelectionOverlap(view, markerStart, markerEnd)) {
              return;
            }

            builder.add(
              markerStart,
              markerEnd,
              Decoration.replace({
                widget: new NumberWidget(parseInt(orderedMatch[2], 10), level),
              })
            );
            return;
          }

          // Check for regular bullet list: -, *, +
          const bulletMatch = lineText.match(/^(\s*)([\-\*\+])(\s+)/);
          if (bulletMatch) {
            const leadingSpaces = bulletMatch[1].length;
            const level = Math.floor(leadingSpaces / 2) + 1;
            const markerStart = line.from + bulletMatch[1].length;
            const markerEnd = markerStart + 1; // Just the marker

            // Show raw source when caret is inside or selection overlaps
            if (shouldShowSource(view.state, markerStart, markerEnd) ||
                hasSelectionOverlap(view, markerStart, markerEnd)) {
              return;
            }

            // Replace the marker with bullet widget
            builder.add(
              markerStart,
              markerEnd,
              Decoration.replace({
                widget: new BulletWidget(level, bulletMatch[2]),
              })
            );
            return;
          }
        }

        // Handle Blockquote - add line decoration
        if (name === "Blockquote") {
          const startLine = view.state.doc.lineAt(nodeFrom);
          const endLine = view.state.doc.lineAt(nodeTo);

          // Add line decoration for each line in the blockquote
          for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
            if (processedLines.has(lineNum)) continue;

            const line = view.state.doc.line(lineNum);
            const lineText = line.text;

            // Check if line starts with >
            const quoteMatch = lineText.match(/^(\s*)(>+)\s*/);
            if (quoteMatch) {
              processedLines.add(lineNum);
              const quoteLevel = quoteMatch[2].length;

              // If caret is inside or selection overlaps the quote marker, show raw source
              const markerStart = line.from + quoteMatch[1].length;
              const markerEnd = markerStart + quoteMatch[2].length;
              if (shouldShowSource(view.state, markerStart, markerEnd) ||
                  hasSelectionOverlap(view, markerStart, markerEnd)) {
                continue;
              }

              // Add line decoration for the blockquote styling
              builder.add(
                line.from,
                line.from,
                Decoration.line({
                  attributes: {
                    class: `cm-blockquote-line cm-blockquote-level-${quoteLevel}`,
                  },
                })
              );

              // Optionally hide or dim the > marker
              builder.add(
                markerStart,
                markerEnd,
                Decoration.mark({
                  class: "cm-blockquote-marker",
                })
              );
            }
          }
        }
      },
    });
  }
  
  return builder.finish();
}

/**
 * List plugin that renders bullets and checkboxes
 * Updated to rebuild on selection changes (like link plugin)
 */
export const listPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    
    constructor(view: EditorView) {
      this.decorations = buildListDecorations(view);
    }
    
    update(update: any) {
      // Rebuild on document, viewport, or selection changes
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildListDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

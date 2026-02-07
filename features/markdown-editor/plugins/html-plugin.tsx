/**
 * Custom HTML plugin for CodeMirror to render HTML blocks and collapsable details/summary
 * Supports inline HTML, styled divs, and details/summary elements
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState as CMEditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { shouldShowSource } from 'codemirror-live-markdown';

/**
 * Parse HTML string and sanitize dangerous attributes
 */
function sanitizeHTML(html: string): string {
  // Remove script tags and on* event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
}

/**
 * Check if HTML content contains a details/summary block
 */
function isDetailsBlock(html: string): boolean {
  return /<details[\s>]/i.test(html) && /<summary[\s>]/i.test(html);
}

/**
 * Extract content between details tags
 */
function extractDetailsContent(html: string): { summary: string; content: string } | null {
  const detailsMatch = html.match(/<details[^>]*>([\s\S]*?)<\/details>/i);
  if (!detailsMatch) return null;

  const innerContent = detailsMatch[1];
  const summaryMatch = innerContent.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);

  if (!summaryMatch) return null;

  const summary = summaryMatch[1].trim();
  const content = innerContent.substring(summaryMatch[0].length).trim();

  return { summary, content };
}

/**
 * Widget to render HTML content
 */
class HTMLBlockWidget extends WidgetType {
  constructor(private html: string) {
    super();
  }

  eq(other: HTMLBlockWidget) {
    return other instanceof HTMLBlockWidget && this.html === other.html;
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-html-block-widget';

    // Sanitize HTML before rendering
    const sanitized = sanitizeHTML(this.html);

    // Create wrapper for rendered content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'cm-html-content';
    contentWrapper.innerHTML = sanitized;

    container.appendChild(contentWrapper);

    return container;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Widget to render collapsable details/summary blocks
 */
class DetailsBlockWidget extends WidgetType {
  constructor(private summary: string, private content: string) {
    super();
  }

  eq(other: DetailsBlockWidget) {
    return other instanceof DetailsBlockWidget &&
           this.summary === other.summary &&
           this.content === other.content;
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-details-block-widget';

    // Create details element
    const details = document.createElement('details');
    details.className = 'cm-details';

    // Create summary element
    const summary = document.createElement('summary');
    summary.className = 'cm-summary';
    summary.innerHTML = sanitizeHTML(this.summary);

    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'cm-details-content';
    contentWrapper.innerHTML = sanitizeHTML(this.content);

    details.appendChild(summary);
    details.appendChild(contentWrapper);
    container.appendChild(details);

    return container;
  }

  ignoreEvent(event: Event) {
    // Allow click events for toggling details
    return event.type === 'click';
  }
}

/**
 * Check if content is a complete HTML block (starts and ends with matching tags)
 */
function isCompleteHTMLBlock(content: string): boolean {
  const trimmed = content.trim();

  // Must start with an opening tag
  if (!/^<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/.test(trimmed)) {
    return false;
  }

  // Extract tag name from opening tag
  const openTagMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
  if (!openTagMatch) return false;

  const tagName = openTagMatch[1].toLowerCase();

  // Self-closing tags
  const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link'];
  if (selfClosingTags.includes(tagName)) {
    return true;
  }

  // Must end with matching closing tag
  const closeTagRegex = new RegExp(`</${tagName}[^>]*>\\s*$`, 'i');
  return closeTagRegex.test(trimmed);
}

/**
 * Build decorations for HTML blocks
 */
function buildHTMLDecorations(state: CMEditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      // Handle HTML blocks (block-level elements)
      if (node.name === 'HTMLBlock') {
        const content = state.doc.sliceString(node.from, node.to).trim();

        if (!content) return;

        // Only handle complete HTML blocks
        if (!isCompleteHTMLBlock(content)) return;

        // Check if cursor/selection is inside
        const isTouched = shouldShowSource(state, node.from, node.to);

        if (!isTouched) {
          // Check if it's a details block
          if (isDetailsBlock(content)) {
            const detailsContent = extractDetailsContent(content);
            if (detailsContent) {
              const widget = new DetailsBlockWidget(
                detailsContent.summary,
                detailsContent.content
              );
              decorations.push(
                Decoration.replace({ widget, block: true }).range(node.from, node.to)
              );
              return;
            }
          }

          // Regular HTML block
          const widget = new HTMLBlockWidget(content);
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
 * Create HTML StateField
 */
const htmlField = StateField.define<DecorationSet>({
  create(state) {
    return buildHTMLDecorations(state);
  },

  update(deco, tr) {
    // Rebuild on document or config change
    if (tr.docChanged || tr.reconfigured) {
      return buildHTMLDecorations(tr.state);
    }

    // Rebuild on selection change
    if (tr.selection) {
      return buildHTMLDecorations(tr.state);
    }

    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * HTML plugin
 * Renders HTML blocks and collapsable details/summary elements
 */
export const htmlPlugin = htmlField;

/**
 * Custom HTML plugin for CodeMirror to render HTML blocks and collapsable details/summary
 * Supports inline HTML, styled divs, and details/summary elements
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState, Range, StateField } from '@codemirror/state';
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

    try {
      // Sanitize HTML before rendering
      const sanitized = sanitizeHTML(this.html);

      // Create wrapper for rendered content
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'cm-html-content';
      contentWrapper.innerHTML = sanitized;

      container.appendChild(contentWrapper);
    } catch (err) {
      console.error('[HTMLBlockWidget] Error rendering:', err);
      container.innerHTML = '<div style="color: red;">Error rendering HTML block</div>';
    }

    return container;
  }

  ignoreEvent() {
    // Let CodeMirror handle all events (for cursor positioning)
    return false;
  }
}

/**
 * Widget to render collapsable details/summary blocks
 */
class DetailsBlockWidget extends WidgetType {
  private summaryElement: HTMLElement | null = null;

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

    try {
      // Create details element
      const details = document.createElement('details');
      details.className = 'cm-details';

      // Create summary element with arrow icon
      const summary = document.createElement('summary');
      summary.className = 'cm-summary';
      this.summaryElement = summary;

      // Add arrow icon
      const arrow = document.createElement('span');
      arrow.className = 'cm-summary-arrow';
      arrow.textContent = '▶';
      summary.appendChild(arrow);

      // Add summary text
      const summaryText = document.createElement('span');
      summaryText.className = 'cm-summary-text';
      summaryText.innerHTML = sanitizeHTML(this.summary);
      summary.appendChild(summaryText);

      // Handle arrow rotation on toggle
      details.addEventListener('toggle', () => {
        if (details.open) {
          arrow.style.transform = 'rotate(90deg)';
        } else {
          arrow.style.transform = 'rotate(0deg)';
        }
      });

      // Create content wrapper
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'cm-details-content';
      contentWrapper.innerHTML = sanitizeHTML(this.content);

      details.appendChild(summary);
      details.appendChild(contentWrapper);
      container.appendChild(details);
    } catch (err) {
      console.error('[DetailsBlockWidget] Error rendering:', err);
      container.innerHTML = '<div style="color: red;">Error rendering details block</div>';
    }

    return container;
  }

  ignoreEvent(event: Event) {
    // Ignore events on the summary element (let native toggle work)
    // But allow CodeMirror to handle events on content (for showing source)
    if (!event.target) return false;

    const target = event.target as HTMLElement;

    // Check if the event target is within the summary element
    if (this.summaryElement && this.summaryElement.contains(target)) {
      // Ignore mousedown/click on summary - let native details toggle work
      if (event.type === 'mousedown' || event.type === 'click') {
        return true;
      }
    }

    // For content area, let CodeMirror handle events (show source on click)
    return false;
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
 * Check if content contains markdown syntax
 */
function containsMarkdown(content: string): boolean {
  // Check for code blocks
  if (/```/.test(content)) return true;
  // Check for lists
  if (/^\s*[-*+]\s/m.test(content)) return true;
  // Check for headings
  if (/^#{1,6}\s/m.test(content)) return true;
  return false;
}

/**
 * Build decorations for HTML blocks
 */
function buildHTMLDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      // Handle HTML blocks (block-level elements)
      if (node.name === 'HTMLBlock') {
        const content = state.doc.sliceString(node.from, node.to).trim();

        if (!content) return;

        // Only handle complete HTML blocks
        if (!isCompleteHTMLBlock(content)) return;

        // Skip blocks that contain markdown syntax
        if (containsMarkdown(content)) return;

        // Check if cursor/selection is inside
        const isTouched = shouldShowSource(state, node.from, node.to);

        if (!isTouched) {
          // Check if it's a details block
          if (isDetailsBlock(content)) {
            const detailsContent = extractDetailsContent(content);
            if (detailsContent) {
              // Skip if content has markdown
              if (containsMarkdown(detailsContent.content)) return;

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

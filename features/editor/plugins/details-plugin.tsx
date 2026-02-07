/**
 * Details/Summary Plugin - Renders native <details> and <summary> HTML elements
 * Provides collapsible sections with custom styling
 * Uses DOMPurify for XSS prevention
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { shouldShowWidgetSourceState } from './plugin-utils';

// Import DOMPurify dynamically for client-side sanitization
let DOMPurify: any = null;
if (typeof window !== 'undefined') {
  import('dompurify').then(module => {
    DOMPurify = module.default;
  });
}

/**
 * Sanitize HTML content using DOMPurify
 */
function sanitizeHTML(html: string): string {
  if (!DOMPurify && typeof window === 'undefined') {
    // Server-side fallback
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  }

  if (DOMPurify) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'code', 'pre',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a',
        'blockquote', 'hr'],
      ALLOWED_ATTR: ['class', 'href', 'title'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'img'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    });
  }

  return html;
}

/**
 * Check if HTML content contains a details/summary block
 */
function isDetailsBlock(html: string): boolean {
  return /<details[\s>]/i.test(html) && /<summary[\s>]/i.test(html);
}

/**
 * Extract content between details tags (handles nested details)
 */
function extractDetailsContent(html: string): { summary: string; content: string } | null {
  // Find the first <summary> tag
  const summaryMatch = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
  if (!summaryMatch) return null;

  const summary = summaryMatch[1].trim();
  
  // Find content after summary up to the last closing </details>
  const summaryEndIndex = html.indexOf('</summary>') + '</summary>'.length;
  const lastDetailsClose = html.lastIndexOf('</details>');
  
  if (lastDetailsClose === -1) return null;
  
  const content = html.substring(summaryEndIndex, lastDetailsClose).trim();

  return { summary, content };
}

/**
 * Simple markdown to HTML converter for details content
 * Handles basic markdown syntax without external dependencies
 */
function markdownToHTML(markdown: string): string {
  let html = markdown;

  // Code blocks (triple backticks)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || 'text';
    return `<pre><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`;
  });

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Lists (simple version) - wrap consecutive list items in ul tags
  html = html.replace(/(?:^(?:\*|-) .+$\n?)+/gim, (match) => {
    const items = match.split('\n').filter(line => line.trim());
    const listItems = items.map(item => {
      const text = item.replace(/^[\*-] /, '');
      return `<li>${text}</li>`;
    }).join('');
    return `<ul>${listItems}</ul>`;
  });

  // Paragraphs (split by double newlines)
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    // Don't wrap if already has block-level tags
    if (/<\/(h[1-6]|pre|ul|ol|blockquote|div)>/.test(p)) {
      return p;
    }
    return `<p>${p.trim()}</p>`;
  }).join('');

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Widget to render collapsable details/summary blocks
 */
class DetailsBlockWidget extends WidgetType {
  private contentWrapperRef: HTMLDivElement | null = null;

  constructor(private summary: string, private content: string) {
    super();
  }

  eq(other: DetailsBlockWidget) {
    return other instanceof DetailsBlockWidget &&
           this.summary === other.summary &&
           this.content === other.content;
  }

  toDOM() {
    const container = document.createElement('span');
    container.className = 'cm-details-block-widget';

    try {
      const details = document.createElement('details');
      details.className = 'cm-details';

      const summary = document.createElement('summary');
      summary.className = 'cm-summary';

      const arrow = document.createElement('span');
      arrow.className = 'cm-summary-arrow';
      arrow.textContent = '▶';
      summary.appendChild(arrow);

      const summaryText = document.createElement('span');
      summaryText.className = 'cm-summary-text';
      summaryText.textContent = this.summary;
      summary.appendChild(summaryText);

      details.addEventListener('toggle', (e) => {
        e.stopPropagation();
        if (details.open) {
          arrow.textContent = '▼';
        } else {
          arrow.textContent = '▶';
        }
      });

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'cm-details-content';
      this.contentWrapperRef = contentWrapper;

      // Mark content area for click detection
      contentWrapper.setAttribute('data-details-content', 'true');
      
      // Convert markdown to HTML and render
      const htmlContent = markdownToHTML(this.content);
      contentWrapper.innerHTML = sanitizeHTML(htmlContent);

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
    // Always allow toggle events to work
    if (event.type === 'toggle') {
      return true;
    }

    // For mousedown/click events, check if target is inside content area
    if (event.type === 'mousedown' || event.type === 'click') {
      const target = event.target as HTMLElement;

      // Check if click is on summary or its children
      const summaryElement = target.closest('.cm-summary');
      if (summaryElement) {
        // Click on summary - ignore it, let native toggle work
        return true;
      }

      // Check if click is on content area or its children
      const contentElement = target.closest('[data-details-content]');
      if (contentElement) {
        // Click on content - allow editor to handle (show source)
        return false;
      }

      // Click somewhere else in the widget - ignore it
      return true;
    }

    // Default: let widget handle the event
    return true;
  }
}

/**
 * Find all details/summary blocks that span multiple HTMLBlock nodes
 */
function findMultiLineDetailsBlocks(state: EditorState): Array<{ from: number; to: number; summary: string; content: string }> {
  const blocks: Array<{ from: number; to: number; summary: string; content: string }> = [];
  const text = state.doc.toString();

  // Find all <details> opening tags
  const detailsRegex = /<details[^>]*>/gi;
  let match;

  while ((match = detailsRegex.exec(text)) !== null) {
    const startPos = match.index;
    
    // Find the matching </details> - need to handle nesting
    let depth = 1;
    let searchPos = startPos + match[0].length;
    let endPos = -1;
    
    const remainingText = text.substring(searchPos);
    const tagRegex = /<\/?details[^>]*>/gi;
    let tagMatch;
    
    while ((tagMatch = tagRegex.exec(remainingText)) !== null) {
      if (tagMatch[0].startsWith('</')) {
        depth--;
        if (depth === 0) {
          endPos = searchPos + tagMatch.index + tagMatch[0].length;
          break;
        }
      } else {
        depth++;
      }
    }
    
    if (endPos === -1) continue;
    
    const fullContent = text.substring(startPos, endPos);
    const detailsContent = extractDetailsContent(fullContent);
    
    if (detailsContent) {
      blocks.push({ 
        from: startPos, 
        to: endPos, 
        summary: detailsContent.summary, 
        content: detailsContent.content 
      });
    }
  }

  return blocks;
}

/**
 * Build decorations for details/summary blocks
 */
function buildDetailsDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const processedRanges = new Set<string>();

  // First, find multi-line details blocks
  const multiLineBlocks = findMultiLineDetailsBlocks(state);
  for (const block of multiLineBlocks) {
    const shouldShowSource = shouldShowWidgetSourceState(state, block.from, block.to);

    if (!shouldShowSource) {
      const widget = new DetailsBlockWidget(block.summary, block.content);
      decorations.push(
        Decoration.replace({ widget, block: true }).range(block.from, block.to)
      );
      
      // Mark range as processed
      for (let pos = block.from; pos <= block.to; pos++) {
        processedRanges.add(`${pos}`);
      }
    }
  }

  // Then handle single HTMLBlock details/summary
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'HTMLBlock') {
        // Skip if already processed
        if (processedRanges.has(`${node.from}`)) return;
        
        const content = state.doc.sliceString(node.from, node.to).trim();

        if (!content || !isDetailsBlock(content)) return;

        const detailsContent = extractDetailsContent(content);
        if (!detailsContent) return;

        // Show source if cursor is inside or text is selected
        const shouldShowSource = shouldShowWidgetSourceState(state, node.from, node.to);

        if (!shouldShowSource) {
          const widget = new DetailsBlockWidget(detailsContent.summary, detailsContent.content);
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
 * Create Details/Summary StateField
 */
const detailsField = StateField.define<DecorationSet>({
  create(state) {
    return buildDetailsDecorations(state);
  },

  update(deco, tr) {
    if (tr.docChanged || tr.reconfigured) {
      return buildDetailsDecorations(tr.state);
    }

    // Rebuild on selection change to show source
    if (tr.selection) {
      return buildDetailsDecorations(tr.state);
    }

    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Details/Summary plugin
 * Renders collapsible <details> and <summary> HTML elements
 */
export const detailsPlugin = detailsField;

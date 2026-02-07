/**
 * HTML Plugin - Renders ```html code blocks as live HTML preview
 * Similar to mermaid plugin, only processes fenced code blocks with html language
 * Uses DOMPurify for robust XSS prevention
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
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr'],
      ALLOWED_ATTR: ['class', 'id', 'style', 'href', 'src', 'alt', 'title', 'width', 'height'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    });
  }

  return html;
}

/**
 * Widget to render HTML content from ```html code blocks
 */
class HTMLCodeBlockWidget extends WidgetType {
  constructor(private html: string) {
    super();
  }

  eq(other: HTMLCodeBlockWidget) {
    return other instanceof HTMLCodeBlockWidget && this.html === other.html;
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-html-block-widget';

    try {
      const sanitized = sanitizeHTML(this.html);
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'cm-html-content';
      contentWrapper.innerHTML = sanitized;
      container.appendChild(contentWrapper);
    } catch (err) {
      console.error('[HTMLCodeBlockWidget] Error rendering:', err);
      container.innerHTML = '<div style="color: red;">Error rendering HTML block</div>';
    }

    return container;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Build decorations: Find all ```html blocks and replace with widgets
 * Skips blocks where cursor/selection is present (shows source instead)
 */
function buildHTMLDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'FencedCode') {
        // Extract language from code info line (```html)
        const codeInfo = node.node.getChild('CodeInfo');
        if (!codeInfo) return;

        const language = state.doc.sliceString(codeInfo.from, codeInfo.to).trim().toLowerCase();

        if (language !== 'html') return;

        // Get actual code content (between opening and closing ```)
        const codeText = node.node.getChild('CodeText');
        const code = codeText
          ? state.doc.sliceString(codeText.from, codeText.to).trim()
          : '';

        if (!code) return;

        // Show source if cursor is inside or text is selected
        const shouldShowSource = shouldShowWidgetSourceState(state, node.from, node.to);

        if (!shouldShowSource) {
          const widget = new HTMLCodeBlockWidget(code);

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
 * Manages decoration lifecycle for ```html code blocks
 */
const htmlField = StateField.define<DecorationSet>({
  create(state) {
    return buildHTMLDecorations(state);
  },

  update(deco, tr) {
    if (tr.docChanged || tr.reconfigured) {
      return buildHTMLDecorations(tr.state);
    }

    // Rebuild on selection change to show source
    if (tr.selection) {
      return buildHTMLDecorations(tr.state);
    }

    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * HTML plugin
 * Renders HTML code from ```html fenced code blocks
 */
export const htmlPlugin = htmlField;

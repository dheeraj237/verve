/**
 * Custom code block plugin for CodeMirror to render code blocks
 * Skips mermaid and math blocks (handled by other plugins)
 * Uses CodeMirror's built-in syntax highlighting (static HTML, no editor instances)
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState as CMEditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { shouldShowWidgetSourceState } from './plugin-utils';
import { highlightTree, classHighlighter } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';

/**
 * Languages to skip (handled by other plugins)
 */
const SKIP_LANGUAGES = new Set(['mermaid', 'math', 'latex', 'html']);

/**
 * Get language parser for syntax highlighting
 */
function getLanguageSupport(lang: string) {
  const langLower = lang.toLowerCase();

  switch (langLower) {
    case 'javascript':
    case 'js':
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    case 'python':
    case 'py':
      return python();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    case 'html':
    case 'xml':
      return html();
    case 'json':
      return json();
    case 'sql':
      return sql();
    case 'markdown':
    case 'md':
    case 'mdx':
    case 'text':
    case 'txt':
      return markdown();
    default:
      return markdown();
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Highlight code using CodeMirror's parser and return HTML
 * Uses classHighlighter to generate .tok- prefixed classes that match the editor theme
 */
function highlightCode(code: string, lang: string): string {
  const langSupport = getLanguageSupport(lang);

  if (!langSupport) {
    // No language support, return escaped plain text
    return escapeHtml(code);
  }

  try {
    // Parse the code
    const tree = langSupport.language.parser.parse(code);
    let result = '';
    let pos = 0;

    // Highlight using tree with classHighlighter (generates .tok- classes)
    highlightTree(tree, classHighlighter, (from, to, classes) => {
      if (from > pos) {
        result += escapeHtml(code.substring(pos, from));
      }
      result += `<span class="${classes}">${escapeHtml(code.substring(from, to))}</span>`;
      pos = to;
    });

    if (pos < code.length) {
      result += escapeHtml(code.substring(pos));
    }

    return result || escapeHtml(code);
  } catch (err) {
    console.error('[CodeBlock] Highlighting failed:', err);
    return escapeHtml(code);
  }
}

/**
 * Widget to render code block with static HTML and CodeMirror highlighting
 */
class CodeBlockWidget extends WidgetType {
  constructor(private code: string, private language: string) {
    super();
  }

  eq(other: CodeBlockWidget) {
    return other instanceof CodeBlockWidget &&
           this.code === other.code &&
           this.language === other.language;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-code-block-widget";

    // Create header with language label and copy button
    const header = document.createElement("div");
    header.className = "cm-code-block-header";

    if (this.language && this.language !== 'text' && this.language !== 'plain') {
      const langLabel = document.createElement("span");
      langLabel.className = "cm-code-block-lang";
      langLabel.textContent = this.language;
      header.appendChild(langLabel);
    }

    // Copy button
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "cm-code-block-copy";
    copyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span class="cm-code-block-copy-text">Copy</span>
    `;

    const code = this.code;
    // Use mousedown to prevent default click behavior that switches to edit mode
    copyButton.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      try {
        await navigator.clipboard.writeText(code);
        copyButton.classList.add("cm-code-block-copy-success");
        const textSpan = copyButton.querySelector('.cm-code-block-copy-text');
        if (textSpan) {
          textSpan.textContent = "Copied!";
        }

        setTimeout(() => {
          copyButton.classList.remove("cm-code-block-copy-success");
          if (textSpan) {
            textSpan.textContent = "Copy";
          }
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

    header.appendChild(copyButton);
    container.appendChild(header);

    // Create code container
    const codeWrapper = document.createElement("div");
    codeWrapper.className = "cm-code-block-content";

    const lines = this.code.split('\n');

    // Create line numbers
    const lineNumbersDiv = document.createElement("div");
    lineNumbersDiv.className = "cm-code-block-line-numbers";
    lines.forEach((_, i) => {
      const lineNum = document.createElement("div");
      lineNum.className = "cm-code-block-line-number";
      lineNum.textContent = String(i + 1);
      lineNumbersDiv.appendChild(lineNum);
    });

    // Create code content with syntax highlighting
    const pre = document.createElement("pre");
    pre.className = "cm-code-block-pre";
    const codeEl = document.createElement("code");
    codeEl.className = "cm-code-block-code";

    // Highlight with CodeMirror
    const highlighted = highlightCode(this.code, this.language);
    codeEl.innerHTML = highlighted;

    pre.appendChild(codeEl);
    codeWrapper.appendChild(lineNumbersDiv);
    codeWrapper.appendChild(pre);
    container.appendChild(codeWrapper);

    return container;
  }

  ignoreEvent(event: Event) {
    // Ignore mousedown events on the copy button to prevent switching to edit mode
    if (event.type === 'mousedown') {
      const target = event.target as HTMLElement;
      if (target.closest('.cm-code-block-copy')) {
        return true; // Tell CodeMirror to ignore this event
      }
    }
    return false;
  }
}

/**
 * Build decorations for code blocks
 */
function buildCodeBlockDecorations(state: CMEditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'FencedCode') {
        // Get language info
        const codeInfo = node.node.getChild('CodeInfo');
        let language = 'text';

        if (codeInfo) {
          language = state.doc.sliceString(codeInfo.from, codeInfo.to).trim().toLowerCase();
        }

        // Skip special languages (handled by other plugins)
        if (SKIP_LANGUAGES.has(language)) {
          return;
        }

        // Get code content
        const codeText = node.node.getChild('CodeText');
        const code = codeText
          ? state.doc.sliceString(codeText.from, codeText.to)
          : '';

        if (!code.trim()) return;

        // Use shared utility to check if source should be shown
        const shouldShowSource = shouldShowWidgetSourceState(state, node.from, node.to);

        if (!shouldShowSource) {
          // Render mode: show widget
          const widget = new CodeBlockWidget(code, language);

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
 * Create code block StateField
 */
const codeBlockField = StateField.define<DecorationSet>({
  create(state) {
    return buildCodeBlockDecorations(state);
  },

  update(deco, tr) {
    // Rebuild on document or config change
    if (tr.docChanged || tr.reconfigured) {
      return buildCodeBlockDecorations(tr.state);
    }

    // Rebuild on selection change
    if (tr.selection) {
      return buildCodeBlockDecorations(tr.state);
    }

    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Code block plugin
 * Renders code blocks with syntax highlighting and line numbers
 */
export const codeBlockPlugin = codeBlockField;


/**
 * Custom link plugin for CodeMirror to handle link navigation
 * Supports Cmd/Ctrl+Click to open links in new tab with tooltips
 * Handles markdown file links for internal navigation
 * Supports anchor links (#heading) for same-file and cross-file navigation
 * Based on official link plugin from codemirror-live-markdown
 */

import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { shouldShowSource, mouseSelectingField } from 'codemirror-live-markdown';
import { isMarkdownFileLink } from '@/shared/utils/file-path-resolver';
import { scrollToHeading } from '@/shared/utils/scroll-to-heading';
import { isMobileDevice } from '@/shared/utils/mobile';

/**
 * Detect operating system
 */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/**
 * Get modifier key name based on OS
 */
function getModifierKeyName(): string {
  return isMac() ? 'Cmd' : 'Ctrl';
}

/**
 * Check if modifier key is pressed
 */
function isModifierKeyPressed(event: MouseEvent): boolean {
  return isMac() ? event.metaKey : event.ctrlKey;
}

/**
 * Link data interface
 */
interface LinkData {
  text: string;
  url: string;
}

/**
 * Parse standard link syntax [text](url)
 */
function parseLinkSyntax(text: string): LinkData | null {
  // Exclude image syntax
  if (text.startsWith('!')) {
    return null;
  }

  // Match [text](url) or [text](url "title") or [text](url 'title')
  const match = text.match(/^\[([^\]]*)\]\((.+?)(?:\s+["']([^"']+)["'])?\)$/);

  if (!match) {
    return null;
  }

  const [, linkText, url] = match;

  return {
    text: linkText,
    url,
  };
}

/**
 * Link widget that makes links clickable with modifier key
 * Handles both external URLs and internal markdown file links
 */
class LinkWidget extends WidgetType {
  constructor(private linkData: LinkData, private currentFilePath?: string) {
    super();
  }

  eq(other: LinkWidget) {
    return other instanceof LinkWidget &&
           this.linkData.text === other.linkData.text &&
           this.linkData.url === other.linkData.url;
  }

  toDOM() {
    const link = document.createElement('a');
    link.className = 'cm-link';
    link.textContent = this.linkData.text;

    // Set href appropriately - for anchors use the actual anchor, for others use '#' to prevent navigation
    const isAnchorLink = this.linkData.url.startsWith('#');
    link.href = isAnchorLink ? 'javascript:void(0)' : '#';
    link.setAttribute('data-url', this.linkData.url);

    const isMarkdownFile = isMarkdownFileLink(this.linkData.url);

    // Tooltip element with Tailwind-style classes
    const tooltip = document.createElement('span');
    tooltip.className = 'absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 border border-gray-700 rounded-md shadow-xl opacity-0 pointer-events-none whitespace-nowrap transition-opacity duration-200';
    tooltip.style.zIndex = '100000';
    tooltip.textContent = isAnchorLink
      ? `${getModifierKeyName()}+Click to jump to section`
      : isMarkdownFile
      ? `${getModifierKeyName()}+Click to open in new tab`
      : `${getModifierKeyName()}+Click to open`;
    link.appendChild(tooltip);

    // Show/hide tooltip on hover
    link.addEventListener('mouseenter', () => {
      tooltip.classList.remove('opacity-0');
      tooltip.classList.add('opacity-100');
    });
    link.addEventListener('mouseleave', () => {
      tooltip.classList.remove('opacity-100');
      tooltip.classList.add('opacity-0');
    });

    // Handle both click and touch events
    const handleLinkActivation = async (e: Event) => {
      if (e instanceof MouseEvent) {
        // For mouse, require modifier key
        e.preventDefault();
        if (!isModifierKeyPressed(e)) {
          return; // For clicks without modifier key, do nothing (let user edit)
        }
      } else if (e instanceof TouchEvent) {
        // For touch, activate link on mobile devices
        e.preventDefault();
        if (!isMobileDevice()) {
          return; // On non-mobile, still require modifier key
        }
      } else {
        return;
      }

      e.stopPropagation();

      // Check for anchor-only links (#heading) - handle first!
      if (this.linkData.url.startsWith('#')) {
        // Same-file anchor navigation
        scrollToHeading(this.linkData.url);
        return; // Stop execution here
      }

      // Check if this is a markdown file link (may have anchor)
      if (isMarkdownFile) {
        try {
          const [filePath, anchor] = this.linkData.url.split('#');

          // Defensive check: don't open if filePath is empty
          if (!filePath || filePath.trim() === '') {
            console.warn('Empty file path in markdown link, treating as anchor');
            if (anchor) {
              scrollToHeading(anchor);
            }
            return;
          }

          const { useEditorStore } = await import('@/features/editor/store/editor-store');
          const store = useEditorStore.getState();
          await store.openFileByPath(filePath, this.currentFilePath, anchor);
        } catch (error) {
          console.error('Failed to open markdown file:', error);
        }
        return; // Stop execution after handling markdown file
      }

      // Only open external URLs if not anchor or markdown file
      if (!this.linkData.url.startsWith('#') && !isMarkdownFile) {
        window.open(this.linkData.url, '_blank', 'noopener,noreferrer');
      }
    };

    link.addEventListener('click', handleLinkActivation);
    link.addEventListener('touchend', handleLinkActivation);

    // Show cursor pointer when hovering with modifier key
    link.addEventListener('mousemove', (e) => {
      if (isModifierKeyPressed(e)) {
        link.style.cursor = 'pointer';
      } else {
        link.style.cursor = 'text';
      }
    });

    return link;
  }

  ignoreEvent(event: Event) {
    // Ignore all click events - we handle them ourselves
    if (event.type === 'click') {
      return true;
    }
    // Ignore touch events - we handle them ourselves
    if (event.type === 'touchstart' || event.type === 'touchend') {
      return true;
    }
    // Ignore mousedown with modifier key (for opening links)
    if (event.type === 'mousedown' && event instanceof MouseEvent) {
      return isModifierKeyPressed(event);
    }
    return false;
  }
}

/**
 * Autolink widget for plain URLs
 * Handles both external URLs and internal markdown file links
 */
class AutolinkWidget extends WidgetType {
  constructor(private url: string, private currentFilePath?: string) {
    super();
  }

  eq(other: AutolinkWidget) {
    return other instanceof AutolinkWidget && this.url === other.url;
  }

  toDOM() {
    const link = document.createElement('a');
    link.className = 'cm-link';
    link.textContent = this.url;

    // Set href appropriately - for anchors use javascript:void(0), for others use '#'
    const isAnchorLink = this.url.startsWith('#');
    link.href = isAnchorLink ? 'javascript:void(0)' : '#';
    link.setAttribute('data-url', this.url);

    const isMarkdownFile = isMarkdownFileLink(this.url);

    // Tooltip element with Tailwind-style classes
    const tooltip = document.createElement('span');
    tooltip.className = 'absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 border border-gray-700 rounded-md shadow-xl opacity-0 pointer-events-none whitespace-nowrap transition-opacity duration-200';
    tooltip.style.zIndex = '100000';
    tooltip.textContent = isAnchorLink
      ? `${getModifierKeyName()}+Click to jump to section`
      : isMarkdownFile
      ? `${getModifierKeyName()}+Click to open in new tab`
      : `${getModifierKeyName()}+Click to open`;
    link.appendChild(tooltip);

    // Show/hide tooltip on hover
    link.addEventListener('mouseenter', () => {
      tooltip.classList.remove('opacity-0');
      tooltip.classList.add('opacity-100');
    });
    link.addEventListener('mouseleave', () => {
      tooltip.classList.remove('opacity-100');
      tooltip.classList.add('opacity-0');
    });

    // Handle both click and touch events on autolinks
    const handleAutolinkActivation = async (e: Event) => {
      if (e instanceof MouseEvent) {
        // For mouse, require modifier key
        e.preventDefault();
        if (!isModifierKeyPressed(e)) {
          return; // For clicks without modifier key, do nothing (let user edit)
        }
      } else if (e instanceof TouchEvent) {
        // For touch, activate link on mobile devices
        e.preventDefault();
        if (!isMobileDevice()) {
          return; // On non-mobile, still require modifier key
        }
      } else {
        return;
      }

      e.stopPropagation();

      // Check for anchor-only links (#heading) - handle first!
      if (this.url.startsWith('#')) {
        // Same-file anchor navigation
        scrollToHeading(this.url);
        return; // Stop execution here
      }

      // Check if this is a markdown file link (may have anchor)
      if (isMarkdownFile) {
        try {
          const [filePath, anchor] = this.url.split('#');

          // Defensive check: don't open if filePath is empty
          if (!filePath || filePath.trim() === '') {
            console.warn('Empty file path in autolink, treating as anchor');
            if (anchor) {
              scrollToHeading(anchor);
            }
            return;
          }

          const { useEditorStore } = await import('@/features/editor/store/editor-store');
          const store = useEditorStore.getState();
          await store.openFileByPath(filePath, this.currentFilePath, anchor);
        } catch (error) {
          console.error('Failed to open markdown file:', error);
        }
        return; // Stop execution after handling markdown file
      }

      // Only open external URLs if not anchor or markdown file
      if (!this.url.startsWith('#') && !isMarkdownFile) {
        window.open(this.url, '_blank', 'noopener,noreferrer');
      }
    };

    link.addEventListener('click', handleAutolinkActivation);
    link.addEventListener('touchend', handleAutolinkActivation);

    // Show cursor pointer when hovering with modifier key
    link.addEventListener('mousemove', (e) => {
      if (isModifierKeyPressed(e)) {
        link.style.cursor = 'pointer';
      } else {
        link.style.cursor = 'text';
      }
    });

    return link;
  }

  ignoreEvent(event: Event) {
    // Ignore all click events - we handle them ourselves
    if (event.type === 'click') {
      return true;
    }
    // Ignore touch events - we handle them ourselves
    if (event.type === 'touchstart' || event.type === 'touchend') {
      return true;
    }
    // Ignore mousedown with modifier key (for opening links)
    if (event.type === 'mousedown' && event instanceof MouseEvent) {
      return isModifierKeyPressed(event);
    }
    return false;
  }
}

/**
 * Skip parent node types (handled by other plugins)
 */
const SKIP_PARENT_TYPES = new Set(['FencedCode', 'CodeBlock', 'InlineCode']);

/**
 * Build link decorations
 */
function buildLinkDecorations(view: EditorView, currentFilePath?: string): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const state = view.state;
  const isDrag = state.field(mouseSelectingField, false);

  // Collect ranges to skip (code blocks, inline code, etc.)
  const skipRanges: Array<{ from: number; to: number }> = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (SKIP_PARENT_TYPES.has(node.name)) {
        skipRanges.push({ from: node.from, to: node.to });
      }
    },
  });

  // Check if position is in skip range
  const isInSkipRange = (from: number, to: number) => {
    return skipRanges.some((r) => from >= r.from && to <= r.to);
  };

  // Process standard links
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'Link') {
        // Skip links inside code blocks
        if (isInSkipRange(node.from, node.to)) {
          return;
        }

        const from = node.from;
        const to = node.to;

        // Get link syntax text
        const text = state.doc.sliceString(from, to);
        const linkData = parseLinkSyntax(text);

        if (!linkData) {
          return;
        }

        // Decide display mode
        const isTouched = shouldShowSource(state, from, to);

        if (!isTouched && !isDrag) {
          // Render mode: show widget
          const widget = new LinkWidget(linkData, currentFilePath);
          decorations.push(Decoration.replace({ widget }).range(from, to));
        } else {
          // Edit mode: add background mark
          decorations.push(
            Decoration.mark({ class: 'cm-link-source' }).range(from, to)
          );
        }
      }

      // Handle autolinks (plain URLs like <https://example.com> or bare URLs)
      if (node.name === 'Autolink' || node.name === 'URL') {
        // Skip autolinks inside code blocks
        if (isInSkipRange(node.from, node.to)) {
          return;
        }

        const from = node.from;
        const to = node.to;

        // Get URL text
        let url = state.doc.sliceString(from, to);

        // Remove angle brackets if present (<url>)
        url = url.replace(/^<|>$/g, '').trim();

        if (!url) {
          return;
        }

        // Decide display mode
        const isTouched = shouldShowSource(state, from, to);

        if (!isTouched && !isDrag) {
          // Render mode: show widget
          const widget = new AutolinkWidget(url, currentFilePath);
          decorations.push(Decoration.replace({ widget }).range(from, to));
        } else {
          // Edit mode: add background mark
          decorations.push(
            Decoration.mark({ class: 'cm-link-source' }).range(from, to)
          );
        }
      }
    },
  });

  return Decoration.set(decorations.sort((a, b) => a.from - b.from), true);
}

/**
 * Custom link plugin with Cmd/Ctrl+Click support
 * Automatically detects current file path for relative link resolution
 */
export const customLinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    currentFilePath: string | undefined;

    constructor(view: EditorView) {
      this.currentFilePath = this.getCurrentFilePath();
      this.decorations = buildLinkDecorations(view, this.currentFilePath);
    }

    getCurrentFilePath(): string | undefined {
      // Try to get current file path from editor store
      try {
        if (typeof window !== 'undefined') {
          // Access Zustand store dynamically
          return (window as any).__currentFilePath;
        }
      } catch (e) {
        // Fallback if store is not accessible
      }
      return undefined;
    }

    update(update: ViewUpdate) {
      // Update current file path if needed
      const newFilePath = this.getCurrentFilePath();
      if (newFilePath !== this.currentFilePath) {
        this.currentFilePath = newFilePath;
      }

      // Rebuild on document or viewport change
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildLinkDecorations(update.view, this.currentFilePath);
        return;
      }

      // Rebuild on drag state change
      const isDragging = update.state.field(mouseSelectingField, false);
      const wasDragging = update.startState.field(mouseSelectingField, false);

      if (wasDragging && !isDragging) {
        this.decorations = buildLinkDecorations(update.view, this.currentFilePath);
        return;
      }

      // Keep unchanged during drag
      if (isDragging) {
        return;
      }

      // Rebuild on selection change
      if (update.selectionSet) {
        this.decorations = buildLinkDecorations(update.view, this.currentFilePath);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

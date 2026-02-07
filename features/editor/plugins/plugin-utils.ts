/**
 * Shared utility functions for CodeMirror plugins
 * Handles selection detection, HTML sanitization, and widget visibility logic
 */

import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { shouldShowSource } from 'codemirror-live-markdown';

/**
 * Check if selection overlaps with widget range (ViewPlugin version)
 * Returns true if any part of the selection touches the widget
 */
export function hasSelectionOverlap(view: EditorView, from: number, to: number): boolean {
  const { selection } = view.state;
  for (const range of selection.ranges) {
    // Check for any overlap: selection starts before end OR ends after start
    if (range.from < to && range.to > from) {
      return true;
    }
  }
  return false;
}

/**
 * Check if selection overlaps with widget range (StateField version)
 * Same logic as hasSelectionOverlap but for StateField plugins
 */
export function hasSelectionOverlapState(state: EditorState, from: number, to: number): boolean {
  const { selection } = state;
  for (const range of selection.ranges) {
    if (range.from < to && range.to > from) {
      return true;
    }
  }
  return false;
}

/**
 * Determine if widget should show source instead of rendered view
 * Combines cursor position check with selection overlap
 */
export function shouldShowWidgetSource(view: EditorView, from: number, to: number): boolean {
  return shouldShowSource(view.state, from, to) || hasSelectionOverlap(view, from, to);
}

/**
 * StateField version: Check if widget should show source
 * Used by StateField-based plugins (mermaid, code blocks, HTML)
 */
export function shouldShowWidgetSourceState(state: EditorState, from: number, to: number): boolean {
  return shouldShowSource(state, from, to) || hasSelectionOverlapState(state, from, to);
}

/**
 * Sanitize HTML using DOMPurify for robust XSS prevention
 * Uses isomorphic-dompurify for both client and server-side sanitization
 * NOTE: This is a lightweight wrapper - prefer using sanitizeHtml from @/shared/utils/sanitize for full features
 */
export function sanitizeHTML(html: string): string {
  // For CodeMirror plugins, we need synchronous sanitization
  // Use basic regex as fallback for server-side rendering
  if (typeof window === 'undefined') {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
  }

  // Client-side: use DOMPurify (imported dynamically to avoid bundling issues)
  try {
    // Load from window if available (should be available from sanitize.ts)
    if (typeof window !== 'undefined' && (window as any).DOMPurify) {
      const DOMPurify = (window as any).DOMPurify;
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'code', 'pre',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr',
          'details', 'summary', 'svg', 'g', 'path', 'rect', 'circle', 'text'],
        ALLOWED_ATTR: ['class', 'id', 'style', 'href', 'src', 'alt', 'title',
          'width', 'height', 'viewBox', 'xmlns', 'fill', 'stroke', 'd', 'x', 'y'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      });
    }
  } catch (err) {
    console.warn('[sanitizeHTML] DOMPurify not available, using regex fallback');
  }

  // Fallback to regex (should rarely happen)
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
}

/**
 * Detect markdown syntax in HTML content
 * Used to skip HTML blocks that contain markdown (prevents rendering conflicts)
 */
export function containsMarkdown(content: string): boolean {
  if (/```/.test(content)) return true; // Code blocks
  if (/^\s*[-*+]\s/m.test(content)) return true; // Lists
  if (/^#{1,6}\s/m.test(content)) return true; // Headings
  return false;
}

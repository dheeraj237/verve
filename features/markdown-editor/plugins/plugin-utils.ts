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
 * Sanitize HTML by removing script tags, event handlers, and margin styles
 * Prevents XSS attacks and layout issues in user-provided HTML content
 */
export function sanitizeHTML(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove <script> tags
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '') // Remove onclick="..." type handlers
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '') // Remove onclick=handler type handlers
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

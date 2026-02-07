import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";

/**
 * Custom theme for the live markdown editor
 * Aligned with the app's design tokens from globals.css
 */

// Light theme colors matching app design tokens
const lightTheme = EditorView.theme({
  "&": {
    color: "hsl(222.2, 47.4%, 11.2%)", // --foreground
    backgroundColor: "hsl(0, 0%, 99%)", // --editor-background
    fontSize: "15px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },

  ".cm-content": {
    caretColor: "hsl(221.2, 83.2%, 53.3%)", // --primary
    padding: "16px 0",
  },

  ".cm-line": {
    padding: "0 24px",
    lineHeight: "1.6",
  },

  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "hsl(221.2, 83.2%, 53.3%)", // --primary
    borderLeftWidth: "2px",
  },

  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "hsl(210, 100%, 95%)", // --editor-selection
  },

  ".cm-activeLine": {
    backgroundColor: "hsl(218, 18%, 97%)", // --sidebar-background (subtle)
  },

  ".cm-gutters": {
    backgroundColor: "hsl(218, 18%, 95%)", // --editor-gutter
    color: "hsl(215.4, 16.3%, 46.9%)", // --muted-foreground
    border: "none",
  },

  ".cm-activeLineGutter": {
    backgroundColor: "hsl(218, 18%, 93%)",
  },

  ".cm-foldPlaceholder": {
    backgroundColor: "hsl(210, 40%, 96.1%)", // --muted
    border: "none",
    color: "hsl(215.4, 16.3%, 46.9%)",
  },

  ".cm-tooltip": {
    border: "1px solid hsl(214.3, 31.8%, 91.4%)", // --border
    backgroundColor: "hsl(0, 0%, 100%)", // --background
    color: "hsl(222.2, 47.4%, 11.2%)",
  },

  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "hsl(210, 40%, 96.1%)", // --muted
      color: "hsl(222.2, 47.4%, 11.2%)",
    },
  },

  ".cm-searchMatch": {
    backgroundColor: "hsl(221.2, 83.2%, 93%)",
    outline: "1px solid hsl(221.2, 83.2%, 73%)",
  },

  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "hsl(221.2, 83.2%, 85%)",
  },

  // Code highlighting for light theme
  ".cm-code-block": {
    backgroundColor: "hsl(210, 40%, 96.1%)", // --muted
    borderRadius: "4px",
    padding: "12px 16px",
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
  },

  ".cm-inline-code": {
    backgroundColor: "hsl(210, 40%, 96.1%)", // --muted
    color: "hsl(0, 84.2%, 40%)", // Slightly darker destructive
    padding: "2px 6px",
    borderRadius: "3px",
    fontSize: "0.9em",
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
  },
}, { dark: false });

// Dark theme colors matching app design tokens
const darkTheme = EditorView.theme({
  "&": {
    color: "hsl(220, 14%, 91%)", // --foreground
    backgroundColor: "hsl(210, 9%, 11%)", // --background
    fontSize: "15px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },

  ".cm-content": {
    caretColor: "hsl(211, 100%, 80%)", // --primary (dark)
    padding: "16px 0",
  },

  ".cm-line": {
    padding: "0 24px",
    lineHeight: "1.6",
  },

  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "hsl(211, 100%, 80%)", // --primary
    borderLeftWidth: "2px",
  },

  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "hsl(210, 20%, 25%)", // --secondary
  },

  ".cm-activeLine": {
    backgroundColor: "hsl(210, 15%, 13%)", // --muted
  },

  ".cm-gutters": {
    backgroundColor: "hsl(210, 7%, 7%)", // --popover
    color: "hsl(218, 11%, 65%)", // --muted-foreground
    border: "none",
  },

  ".cm-activeLineGutter": {
    backgroundColor: "hsl(210, 10%, 10%)",
  },

  ".cm-foldPlaceholder": {
    backgroundColor: "hsl(210, 15%, 13%)", // --muted
    border: "none",
    color: "hsl(218, 11%, 65%)",
  },

  ".cm-tooltip": {
    border: "1px solid hsl(215, 14%, 20%)", // --border
    backgroundColor: "hsl(210, 7%, 7%)", // --popover
    color: "hsl(220, 14%, 91%)",
  },

  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "hsl(210, 15%, 13%)", // --muted
      color: "hsl(220, 14%, 91%)",
    },
  },

  ".cm-searchMatch": {
    backgroundColor: "hsl(211, 100%, 25%)",
    outline: "1px solid hsl(211, 100%, 50%)",
  },

  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "hsl(211, 100%, 35%)",
  },

  // Code highlighting for dark theme
  ".cm-code-block": {
    backgroundColor: "hsl(210, 15%, 13%)", // --muted
    borderRadius: "4px",
    padding: "12px 16px",
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
  },

  ".cm-inline-code": {
    backgroundColor: "hsl(210, 15%, 13%)", // --muted
    color: "hsl(0, 100%, 80%)", // Lighter destructive for dark mode
    padding: "2px 6px",
    borderRadius: "3px",
    fontSize: "0.9em",
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
  },
}, { dark: true });

/**
 * Get the app-aligned theme based on dark mode
 */
export function getAppTheme(isDark: boolean): Extension {
  return isDark ? darkTheme : lightTheme;
}

/**
 * Syntax highlighting theme that matches the app theme
 */
export const appSyntaxHighlighting = EditorView.theme({
  // Comments
  ".tok-comment": {
    color: "hsl(218, 11%, 65%)", // --muted-foreground
    fontStyle: "italic",
  },

  // Keywords
  ".tok-keyword": {
    color: "hsl(221.2, 83.2%, 53.3%)", // --primary (light)
    fontWeight: "600",
  },

  // Strings
  ".tok-string": {
    color: "hsl(142, 76%, 36%)", // Green
  },

  // Numbers
  ".tok-number": {
    color: "hsl(24, 100%, 50%)", // Orange
  },

  // Functions
  ".tok-function": {
    color: "hsl(221.2, 83.2%, 53.3%)", // --primary
    fontWeight: "500",
  },

  // Variables
  ".tok-variableName": {
    color: "hsl(222.2, 47.4%, 11.2%)", // --foreground
  },

  // Types
  ".tok-typeName, .tok-className": {
    color: "hsl(280, 100%, 60%)", // Purple
  },

  // Operators
  ".tok-operator": {
    color: "hsl(222.2, 47.4%, 11.2%)", // --foreground
  },

  // Properties
  ".tok-propertyName": {
    color: "hsl(211, 100%, 45%)", // Blue
  },
}, { dark: false });

export const appSyntaxHighlightingDark = EditorView.theme({
  // Comments
  ".tok-comment": {
    color: "hsl(218, 11%, 65%)", // --muted-foreground
    fontStyle: "italic",
  },

  // Keywords
  ".tok-keyword": {
    color: "hsl(211, 100%, 80%)", // --primary (dark)
    fontWeight: "600",
  },

  // Strings
  ".tok-string": {
    color: "hsl(142, 76%, 56%)", // Lighter green for dark
  },

  // Numbers
  ".tok-number": {
    color: "hsl(24, 100%, 65%)", // Lighter orange for dark
  },

  // Functions
  ".tok-function": {
    color: "hsl(211, 100%, 80%)", // --primary (dark)
    fontWeight: "500",
  },

  // Variables
  ".tok-variableName": {
    color: "hsl(220, 14%, 91%)", // --foreground (dark)
  },

  // Types
  ".tok-typeName, .tok-className": {
    color: "hsl(280, 100%, 75%)", // Lighter purple for dark
  },

  // Operators
  ".tok-operator": {
    color: "hsl(220, 14%, 91%)", // --foreground (dark)
  },

  // Properties
  ".tok-propertyName": {
    color: "hsl(211, 100%, 70%)", // Lighter blue for dark
  },
}, { dark: true });

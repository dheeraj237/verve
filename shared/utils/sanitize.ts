import DOMPurify from "dompurify";

/**
 * Sanitize HTML content to prevent XSS attacks
 * This should be used before rendering any user-generated content
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    // Server-side: return as-is, will be sanitized on client
    return html;
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      // Text formatting
      "b", "i", "u", "strong", "em", "mark", "small", "del", "ins", "sub", "sup",
      // Headings
      "h1", "h2", "h3", "h4", "h5", "h6",
      // Paragraphs & blocks
      "p", "br", "hr", "div", "span", "blockquote", "pre", "code",
      // Lists
      "ul", "ol", "li", "dl", "dt", "dd",
      // Links & media
      "a", "img", "picture", "source",
      // Tables
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "col", "colgroup",
      // Semantic
      "article", "section", "nav", "aside", "header", "footer", "main",
      "figure", "figcaption", "details", "summary",
      // Other
      "abbr", "address", "cite", "kbd", "samp", "var", "time", "data",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class", "id", "style",
      "width", "height", "loading", "decoding",
      "target", "rel", "type", "lang", "dir",
      "colspan", "rowspan", "headers", "scope",
      "datetime", "value", "open",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "textarea", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

/**
 * Sanitize markdown content by removing potentially dangerous patterns
 * This is a lightweight sanitization for markdown text
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown) return "";

  // Remove script tags and event handlers
  let sanitized = markdown
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");

  return sanitized.trim();
}

/**
 * Sanitize file path to prevent directory traversal attacks
 */
export function sanitizeFilePath(path: string): string {
  if (!path) return "";

  // Remove any ../ or ..\\ patterns
  let sanitized = path.replace(/\.\.[\/\\]/g, "");
  
  // Remove leading slashes
  sanitized = sanitized.replace(/^[\/\\]+/, "");
  
  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, "");

  return sanitized;
}

# Security Documentation

## Overview

MDNotes Viewer follows security best practices to protect against common web vulnerabilities. This document outlines our security measures and guidelines for contributors.

## Table of Contents

1. [XSS Prevention](#xss-prevention)
2. [File System Security](#file-system-security)
3. [Input Sanitization](#input-sanitization)
4. [Dependencies](#dependencies)
5. [Best Practices](#best-practices)

---

## XSS Prevention

### HTML Sanitization

All user-generated HTML content is sanitized using **DOMPurify**, an industry-standard HTML sanitizer that prevents XSS attacks.

#### Implementation

**Location**: `shared/utils/sanitize.ts`

```typescript
import DOMPurify from "dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...],
    FORBIDDEN_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBIDDEN_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}
```

#### Where Sanitization is Applied

1. **Markdown Editor & Preview** (`features/editor/components/markdown-preview.tsx`)
   - Uses `rehype-sanitize` plugin for react-markdown
   - Content is sanitized before markdown parsing with `sanitizeMarkdown()`

2. **HTML Code Blocks** (`features/editor/plugins/html-plugin.tsx`)
   - All HTML in ```html code blocks is sanitized with DOMPurify
   - Prevents script injection in live HTML preview

3. **Details/Summary Blocks** (`features/editor/plugins/details-plugin.tsx`)
   - Collapsible content is sanitized before rendering
   - Protects against XSS in nested HTML

4. **Mermaid Diagrams**
   - Uses `securityLevel: "strict"` to prevent arbitrary JavaScript execution
   - SVG output is rendered safely

### rehype-sanitize Configuration

The markdown preview uses two critical plugins:
- `rehype-raw`: Allows HTML in markdown
- `rehype-sanitize`: **MUST** be used after `rehype-raw` to sanitize HTML

```typescript
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[
    rehypeRaw,      // Parse HTML tags
    rehypeSanitize  // ⚠️ CRITICAL: Sanitize HTML
  ]}
>
```

**⚠️ WARNING**: Never use `rehypeRaw` without `rehypeSanitize`!

---

## File System Security

### Directory Traversal Prevention

API routes include multiple layers of protection against directory traversal attacks:

**Location**: `app/api/files/[...path]/route.ts`

#### 1. Path Component Validation

```typescript
// Reject paths containing .. or null bytes
if (filePath.some(part => part.includes('..') || part.includes('\0'))) {
  return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
}
```

#### 2. Absolute Path Resolution

```typescript
const contentDir = path.join(process.cwd(), "content");
const resolvedPath = path.resolve(fullPath);

// Ensure resolved path is within content directory
if (!resolvedPath.startsWith(contentDir)) {
  return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
}
```

#### 3. File Type Restrictions

```typescript
// Only allow markdown files
const ext = path.extname(resolvedPath).toLowerCase();
if (ext !== '.md' && ext !== '.mdx') {
  return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
}
```

#### 4. File Size Limits

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (stats.size > MAX_FILE_SIZE) {
  return NextResponse.json({ error: "File too large" }, { status: 413 });
}
```

### File Upload Security (Future)

When implementing file uploads:
- ✅ Validate MIME types
- ✅ Scan for malware
- ✅ Generate unique filenames
- ✅ Store outside webroot
- ✅ Implement rate limiting

---

## Input Sanitization

### Markdown Sanitization

**Location**: `shared/utils/sanitize.ts`

```typescript
export function sanitizeMarkdown(markdown: string): string {
  return markdown
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");
}
```

Removes:
- `<script>` tags
- Event handlers (`onclick`, `onload`, etc.)
- `javascript:` protocol in URLs

### File Path Sanitization

```typescript
export function sanitizeFilePath(path: string): string {
  return path
    .replace(/\.\.[\/\\]/g, "")  // Remove ../
    .replace(/^[\/\\]+/, "")      // Remove leading slashes
    .replace(/\0/g, "");          // Remove null bytes
}
```

---

## Dependencies

### Security-Critical Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `dompurify` | HTML sanitization | ^3.3.1 |
| `rehype-sanitize` | Markdown HTML sanitization | ^6.0.0 |
| `mermaid` | Diagram rendering (strict mode) | ^11.12.2 |

### Dependency Security

1. **Regular Updates**: Run `yarn audit` and `yarn upgrade-interactive --latest` regularly
2. **Audit Reports**: Review security advisories with `yarn audit`
3. **Lockfile**: Commit `yarn.lock` to ensure consistent versions

```bash
# Check for vulnerabilities
yarn audit

# Fix auto-fixable vulnerabilities
yarn audit fix

# Interactive upgrade
yarn upgrade-interactive --latest
```

---

## Best Practices

### For Contributors

#### 1. Never Use `dangerouslySetInnerHTML`

❌ **BAD:**
```typescript
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

✅ **GOOD:**
```typescript
import { sanitizeHtml } from "@/shared/utils/sanitize";
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
```

#### 2. Always Sanitize Before `innerHTML`

❌ **BAD:**
```typescript
element.innerHTML = userContent;
```

✅ **GOOD:**
```typescript
import { sanitizeHtml } from "@/shared/utils/sanitize";
element.innerHTML = sanitizeHtml(userContent);
```

Or use DOMPurify directly:
```typescript
import DOMPurify from "dompurify";
element.innerHTML = DOMPurify.sanitize(userContent);
```

#### 3. Validate All User Input

```typescript
// Validate file paths
if (!isValidPath(filePath)) {
  throw new Error("Invalid path");
}

// Validate content size
if (content.length > MAX_SIZE) {
  throw new Error("Content too large");
}

// Validate file types
const allowedExtensions = ['.md', '.mdx'];
if (!allowedExtensions.includes(ext)) {
  throw new Error("Invalid file type");
}
```

#### 4. Use Content Security Policy (CSP)

**Location**: `next.config.ts` (to be added)

```typescript
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  }
];
```

#### 5. Escape Code Display

When showing code snippets, always escape HTML:

```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

---

## Security Checklist

Before merging any PR, verify:

- [ ] All user input is validated
- [ ] HTML content is sanitized with DOMPurify
- [ ] File operations check for directory traversal
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No direct `innerHTML` assignments without sanitization
- [ ] Mermaid uses `securityLevel: "strict"`
- [ ] File uploads have size limits
- [ ] API routes validate input parameters
- [ ] Dependencies are up to date
- [ ] No hardcoded secrets or credentials

---

## Vulnerability Disclosure

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email security concerns to: [your-email@domain.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## Security Audit History

| Date | Auditor | Changes |
|------|---------|---------|
| 2026-02-07 | GitHub Copilot | Initial security review and hardening |

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Last Updated**: February 7, 2026  
**Version**: 1.0.0

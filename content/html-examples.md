# HTML and Collapsable Content Examples

This document demonstrates HTML blocks and collapsable sections in the markdown editor.

## HTML Content

You can embed styled HTML directly in your markdown:

<div style="background-color: #f0f0f0; padding: 10px; border-radius: 5px;">
This is HTML content within Markdown.
</div>

<div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0;">
  <strong>Info Box:</strong> This is a styled information box using HTML.
</div>

<div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
  <strong>⚠️ Warning:</strong> This is a warning message with custom styling.
</div>

## Collapsable Sections

Use `<details>` and `<summary>` tags to create collapsable sections:

<details>
<summary>Click to expand</summary>

This content is hidden by default and can be expanded.

```javascript
console.log("Hidden code block");
```

</details>

<details>
<summary>📚 More Examples</summary>

You can put any markdown content inside collapsable sections:

- List item 1
- List item 2
- List item 3

**Bold text** and *italic text* work too!

</details>

<details>
<summary>🚀 Advanced Usage</summary>

Collapsable sections can contain multiple types of content:

### Nested Heading

This is a paragraph inside a collapsable section.

```python
def hello_world():
    print("Hello from inside a collapsable section!")
```

You can also nest HTML:

<div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">
Nested HTML inside a collapsable section
</div>

</details>

## Combined Usage

<div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🎉 Success Message</h3>

  <p>This div contains a collapsable section inside it:</p>

  <details>
  <summary>Show technical details</summary>

  - Status: Success
  - Time: 2024-01-01 12:00:00
  - Duration: 2.5s

  </details>
</div>

## Notes

- HTML blocks render with proper styling in preview mode
- Click to expand/collapse details sections
- Edit mode shows raw HTML/markdown source
- Supports inline styles and various HTML tags

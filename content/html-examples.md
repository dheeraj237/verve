# HTML and Collapsable Content Examples

This document demonstrates HTML blocks and collapsable sections in the markdown editor.

## HTML Code Content

You can embed styled HTML directly in your markdown:
```html
<div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
  <strong>⚠️ Warning:</strong> This is a warning message with custom styling.
</div>
```

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

```html
<div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">
Nested HTML inside a collapsable section
</div>
```

</details>

## Notes

- HTML blocks render with proper styling in preview mode
- Click to expand/collapse details sections
- Edit mode shows raw HTML/markdown source
- Supports inline styles and various HTML tags
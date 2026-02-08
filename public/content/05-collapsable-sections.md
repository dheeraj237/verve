# Collapsable Sections (Details & Summary)

This document demonstrates the use of HTML `<details>` and `<summary>` tags to create interactive collapsable sections.

## Basic Collapsable Section

<details>
<summary>Click to expand</summary>

This content is hidden by default and can be expanded by clicking the summary.

</details>

---

## Section with Formatted Content

<details>
<summary>🎨 Styling Examples</summary>

You can put any markdown content inside collapsable sections:

**Bold text** and *italic text* work perfectly!

- List item 1
- List item 2
- List item 3

Even `inline code` works great.

</details>

---

## Section with Code Blocks

<details>
<summary>📝 JavaScript Example</summary>

Here's a complete JavaScript example:

```javascript
// Function to greet user
function greetUser(name) {
    const greeting = `Hello, ${name}!`;
    console.log(greeting);
    return greeting;
}

// Call the function
greetUser("World");
```

You can include code blocks with syntax highlighting!

</details>

<details>
<summary>🐍 Python Example</summary>

And here's a Python example:

```python
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

# Generate first 10 Fibonacci numbers
for i in range(10):
    print(f"F({i}) = {calculate_fibonacci(i)}")
```

Multiple code blocks work too!

</details>

---

## Documentation Example

<details>
<summary>📚 API Documentation</summary>

### GET /api/users

Retrieves a list of all users.

**Parameters:**
- `page` (optional): Page number for pagination
- `limit` (optional): Number of results per page

**Response:**
```json
{
  "status": "success",
  "data": {
    "users": [
      {"id": 1, "name": "John"},
      {"id": 2, "name": "Jane"}
    ],
    "total": 100,
    "page": 1
  }
}
```

</details>

<details>
<summary>📚 POST /api/users</summary>

Creates a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

</details>

---

## FAQ Section

<details>
<summary>❓ What is MDNotes Viewer?</summary>

MDNotes Viewer is a modern, VSCode-inspired markdown documentation viewer built with Next.js. It provides a professional interface for viewing and editing markdown files with syntax highlighting, auto-save, and a feature-rich editing experience.

</details>

<details>
<summary>❓ How do I create collapsable sections?</summary>

Use HTML `<details>` and `<summary>` tags:

```html
<details>
<summary>Your summary text here</summary>

Your content goes here...

</details>
```

</details>

<details>
<summary>❓ Can I nest markdown inside details?</summary>

Yes! You can include:
- **Formatted text** (bold, italic, etc.)
- Lists (ordered and unordered)
- Code blocks with syntax highlighting
- Tables
- Links and images
- Blockquotes
- And more!

</details>

<details>
<summary>❓ How do I edit the content?</summary>

Simply click inside the content area to switch to edit mode. The entire details section will un-render, showing you the raw markdown source. Click outside to return to preview mode.

</details>

---

## Installation Instructions

<details>
<summary>🚀 Install with npm</summary>

```bash
npm install mdnotes-viewer
```

Then import and use in your project:

```javascript
import { MarkdownViewer } from 'mdnotes-viewer';

function App() {
  return <MarkdownViewer content={markdownContent} />;
}
```

</details>

<details>
<summary>🚀 Install with yarn</summary>

```bash
yarn add mdnotes-viewer
```

Configuration:

```javascript
import { MarkdownViewer } from 'mdnotes-viewer';

const config = {
  theme: 'dark',
  showLineNumbers: true,
  autoSave: true
};

function App() {
  return <MarkdownViewer content={content} config={config} />;
}
```

</details>

<details>
<summary>🚀 Install with pnpm</summary>

```bash
pnpm add mdnotes-viewer
```

Advanced usage:

```typescript
import { MarkdownViewer, ViewerConfig } from 'mdnotes-viewer';

const config: ViewerConfig = {
  theme: 'auto',
  features: {
    mermaid: true,
    mathJax: true,
    syntaxHighlight: true
  }
};
```

</details>

---

## Troubleshooting

<details>
<summary>⚠️ Content not rendering</summary>

**Problem:** The markdown content inside details tags is not rendering properly.

**Solution:** Make sure you have a blank line after the opening `<summary>` tag and before the closing `</details>` tag.

**Correct:**
```html
<details>
<summary>Title</summary>

Content here with blank lines

</details>
```

**Incorrect:**
```html
<details>
<summary>Title</summary>
Content here without blank lines
</details>
```

</details>

<details>
<summary>⚠️ Section won't expand</summary>

**Problem:** Clicking the summary doesn't expand the section.

**Possible causes:**
1. JavaScript is disabled
2. CSS conflicts
3. Incorrect HTML structure

**Solutions:**
- Check browser console for errors
- Verify HTML syntax
- Test in different browsers

</details>

---

## Best Practices

<details>
<summary>💡 Writing Clear Summaries</summary>

- Keep summaries concise and descriptive
- Use emoji or icons for visual interest
- Make summaries scannable
- Front-load important keywords
- Be consistent in formatting

</details>

<details>
<summary>💡 Organizing Content</summary>

- Group related information together
- Use collapsable sections for optional details
- Keep expanded content focused
- Don't nest too deeply
- Consider mobile users

</details>

<details>
<summary>💡 Performance Tips</summary>

- Limit the number of collapsable sections per page
- Keep content inside sections reasonable in size
- Use lazy loading for images in collapsed sections
- Test with many sections expanded
- Monitor page load times

</details>

---

## Real-World Examples

<details>
<summary>📊 Data Analysis Results</summary>

### Summary Statistics

| Metric | Value |
|--------|------:|
| Total Records | 10,000 |
| Average | 45.6 |
| Median | 42.3 |
| Std Dev | 12.8 |

### Insights

The analysis reveals a **normal distribution** with slight right skew. Key findings:

1. 80% of values fall within one standard deviation
2. No significant outliers detected
3. Strong correlation with variable X (r=0.85)

</details>

<details>
<summary>🔐 Security Guidelines</summary>

### Password Requirements

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot contain common words
- Cannot be previously used

### Two-Factor Authentication

Enable 2FA using:
- Authenticator app (recommended)
- SMS (less secure)
- Hardware key (most secure)

### Best Practices

1. Never share credentials
2. Use unique passwords
3. Enable 2FA everywhere
4. Review access logs regularly
5. Report suspicious activity immediately

</details>

---

**Interactive Tip**: Try clicking on different parts of the details sections!
- Click the **summary** to expand/collapse
- Click inside the **content area** to edit the source code
- Click **outside** to return to preview mode

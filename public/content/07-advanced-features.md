# Advanced Features

This document showcases advanced markdown features including links, images, math expressions, and more.

## Links

### Simple Links

[External Link](https://github.com)
[Link with Title](https://github.com "Visit GitHub")

### Reference Links

This is [a reference link][ref1] and another [reference link][ref2].

You can also use [implicit reference links] by just using the link text.

[ref1]: https://www.example.com "Example Domain"
[ref2]: https://www.markdownguide.org "Markdown Guide"
[implicit reference links]: https://www.wikipedia.org

### Auto Links

<https://www.example.com>
<mailto:hello@example.com>

### Links with Shortcuts

You can use `Ctrl+Click` (Windows/Linux) or `Cmd+Click` (Mac) to open links in a new tab!

---

## Images

### Basic Images

![Sample Image](https://picsum.photos/600/300)

### Image with Alt Text and Title

![Beautiful Landscape](https://picsum.photos/500/300 "A beautiful landscape photo")

### Multiple Images

![Image 1](https://picsum.photos/300/200?random=1)
![Image 2](https://picsum.photos/300/200?random=2)
![Image 3](https://picsum.photos/300/200?random=3)

### Image as Link

[![Click me](https://picsum.photos/400/200)](https://example.com)

---

## Math Expressions (KaTeX)

### Inline Math

The quadratic formula is $ax^2 + bx + c = 0$ and its solution is $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$.

Einstein's famous equation: $E = mc^2$

Pythagorean theorem: $a^2 + b^2 = c^2$

### Block Math

The fundamental theorem of calculus:

$$
\int_{a}^{b} f(x) dx = F(b) - F(a)
$$

Euler's identity:

$$
e^{i\pi} + 1 = 0
$$

Matrix representation:

$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$

Sum notation:

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

---

## Footnotes

Here's a sentence with a footnote[^1].

Another reference to a different footnote[^note].

You can also use inline footnotes^[This is an inline footnote].

[^1]: This is the first footnote with more detailed information.
[^note]: This is a named footnote. You can use any identifier you want.

---

## Abbreviations

*[HTML]: Hyper Text Markup Language
*[CSS]: Cascading Style Sheets
*[JS]: JavaScript
*[API]: Application Programming Interface

When you write HTML, CSS, and JS, they'll show abbreviation tooltips on hover.

The API documentation explains how to use the REST API.

---

## Definition Lists

Term 1
: This is the definition of term 1.
: It can have multiple definitions.

Term 2
: This is the definition of term 2.

Markdown
: A lightweight markup language
: Created by John Gruber in 2004
: Easy to read and write

---

## Keyboard Keys

Press <kbd>Ctrl</kbd> + <kbd>C</kbd> to copy.

Press <kbd>Cmd</kbd> + <kbd>V</kbd> to paste.

Use <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.

Shortcut: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> for command palette.

---

## Subscript and Superscript

### Subscript (Using HTML)

H<sub>2</sub>O (water)

CO<sub>2</sub> (carbon dioxide)

### Superscript (Using HTML)

E = mc<sup>2</sup>

X<sup>2</sup> + Y<sup>2</sup> = Z<sup>2</sup>

2<sup>8</sup> = 256

---

## Horizontal Rules / Dividers

You can create horizontal rules using three or more characters:

Using hyphens:

---

Using asterisks:

***

Using underscores:

___

---

## HTML Elements

### Details and Summary (Interactive)

<details>
<summary>Click to expand HTML example</summary>

You can embed HTML directly in markdown:

<div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #2196F3; margin: 10px 0;">
  <strong>ℹ️ Info:</strong> This is a custom info box created with HTML.
</div>

</details>

### Styled Boxes

<div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
  <strong>⚠️ Warning:</strong> This is a warning message with custom styling.
</div>

<div style="background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
  <strong>✅ Success:</strong> Operation completed successfully!
</div>

<div style="background-color: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
  <strong>❌ Error:</strong> Something went wrong. Please try again.
</div>

### Custom Tables with HTML

<table style="border-collapse: collapse; width: 100%;">
  <tr style="background-color: #f2f2f2;">
    <th style="padding: 10px; border: 1px solid #ddd;">Feature</th>
    <th style="padding: 10px; border: 1px solid #ddd;">Status</th>
  </tr>
  <tr>
    <td style="padding: 10px; border: 1px solid #ddd;">Live Preview</td>
    <td style="padding: 10px; border: 1px solid #ddd;">✅ Enabled</td>
  </tr>
  <tr style="background-color: #f9f9f9;">
    <td style="padding: 10px; border: 1px solid #ddd;">Auto-save</td>
    <td style="padding: 10px; border: 1px solid #ddd;">✅ Enabled</td>
  </tr>
</table>

---

## Videos (HTML5)

You can embed videos using HTML:

<video width="100%" controls>
  <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

---

## Audio (HTML5)

Embed audio files:

<audio controls>
  <source src="https://www.w3schools.com/html/horse.mp3" type="audio/mpeg">
  Your browser does not support the audio element.
</audio>

---

## Progress Bars

<progress value="70" max="100">70%</progress> 70% Complete

<progress value="30" max="100">30%</progress> 30% Complete

<progress value="95" max="100">95%</progress> 95% Complete

---

## Color Swatches

Using HTML for colored text and backgrounds:

<span style="color: #e74c3c;">Red text</span>
<span style="color: #3498db;">Blue text</span>
<span style="color: #2ecc71;">Green text</span>
<span style="color: #f39c12;">Orange text</span>

<span style="background-color: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px;">Red badge</span>
<span style="background-color: #3498db; color: white; padding: 2px 6px; border-radius: 3px;">Blue badge</span>
<span style="background-color: #2ecc71; color: white; padding: 2px 6px; border-radius: 3px;">Green badge</span>

---

## Anchors / Internal Links

You can link to sections within the document:

Jump to [Math Expressions](#math-expressions-katex)

Jump to [Links](#links)

Jump to [Images](#images)

---

## Comments

You can add HTML comments that won't be visible in the rendered output:

<!-- This is a comment and won't be displayed -->

<!-- 
Multi-line comment
Still hidden
Not visible
-->

---

## Emojis and Special Characters

### Common Emojis

😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇
🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝
🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡 🤐 🤨 😐 😑 😶

### Objects

📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 💾 💿 📀 🧮 🎥 🎞️ 📞
📟 📠 📺 📻 🎙️ 🎚️ 🎛️ ⏱️ ⏲️ ⏰ 🕰️ ⏳ ⌛

### Symbols

✓ ✔ ✗ ✘ ✕ ✖ ★ ☆ ⭐ ✨ ⚡ 🔥 💧 ❄️ ☁️ 🌙 ☀️
♠ ♣ ♥ ♦ ♪ ♫ ♯ © ® ™ § ¶ † ‡ • ° ′ ″

### Arrows

← → ↑ ↓ ↔ ↕ ⇐ ⇒ ⇑ ⇓ ⇔ ⤴️ ⤵️ ➡️ ⬅️ ⬆️ ⬇️

---

## Best Practices

✅ **Do:**
- Use semantic HTML when needed
- Keep markdown simple and readable
- Test links regularly
- Optimize images for web
- Use alt text for accessibility

❌ **Don't:**
- Overuse HTML in markdown
- Hotlink images from other sites
- Create excessively large files
- Forget about mobile users
- Neglect accessibility

---

## Tips and Tricks

💡 **Image Loading**: Images load asynchronously for better performance

💡 **Math Rendering**: KaTeX is used for fast math rendering

💡 **Link Hover**: Hover over abbreviations to see their full form

💡 **Interactive Elements**: Click inside collapsable sections to edit

💡 **Keyboard Shortcuts**: Use Cmd/Ctrl+Click to open links in new tabs

---

**Ready to explore?** Try clicking on any element to see its source code and start editing!

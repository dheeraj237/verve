# Lists and Task Lists

This document demonstrates different types of lists and task management features.

## Unordered Lists

You can create unordered lists using `-`, `*`, or `+`:

- Item 1
- Item 2
- Item 3
  - Nested item A
  - Nested item B
    - Deep nested item 1
    - Deep nested item 2
  - Nested item C
- Item 4

Alternative bullets with asterisks:

* First item
* Second item
* Third item

Alternative bullets with plus signs:

+ Alpha
+ Beta
+ Gamma

---

## Ordered Lists

Create numbered lists using `1.`, `2.`, `3.`, etc:

1. First step
2. Second step
3. Third step
   1. Sub-step 3.1
   2. Sub-step 3.2
   3. Sub-step 3.3
4. Fourth step
5. Fifth step

You can also use `1.` for all items and they'll auto-number:

1. First item
1. Second item (also marked as 1)
1. Third item (also marked as 1)

---

## Task Lists

Create interactive checkboxes with `- [ ]` for unchecked and `- [x]` for checked:

### Project Tasks

- [x] Set up project repository
- [x] Create initial documentation
- [ ] Implement core features
- [ ] Write unit tests
- [ ] Deploy to production
- [ ] Gather user feedback

### Shopping List

- [x] Milk
- [x] Bread
- [ ] Eggs
- [ ] Butter
- [ ] Coffee
- [x] Tea

### Weekly Goals

- [ ] Exercise 3 times
- [x] Read for 30 minutes daily
- [ ] Learn a new programming concept
- [x] Write blog post
- [ ] Organize workspace

---

## Mixed and Complex Lists

You can combine different list types:

1. **Phase 1: Planning**
   - [x] Define requirements
   - [x] Create wireframes
   - [ ] Get stakeholder approval
   
2. **Phase 2: Development**
   - [ ] Set up development environment
   - [ ] Implement features
     - [ ] User authentication
     - [ ] Dashboard UI
     - [ ] Data visualization
   - [ ] Code review
   
3. **Phase 3: Testing**
   - [ ] Unit testing
   - [ ] Integration testing
   - [ ] User acceptance testing

---

## Definition Lists

You can create definition lists (if supported):

Term 1
: This is the definition of term 1

Term 2
: This is the definition of term 2
: Terms can have multiple definitions

Markdown
: A lightweight markup language
: Created by John Gruber in 2004
: Easy to read and write

---

## Lists with Code and Formatting

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   - Run `npm run dev`
   - Open browser to `http://localhost:3000`
   - See changes in *real-time*

3. **Build for production**
   ```bash
   npm run build
   npm start
   ```

---

## Tips for Working with Lists

- Use consistent indentation (2 or 4 spaces)
- Leave blank lines between complex list items for clarity
- Task lists work great for project management
- You can nest lists up to several levels deep
- Combine lists with other markdown elements

---

**Pro Tip**: Click on any task checkbox to toggle its state between checked and unchecked!

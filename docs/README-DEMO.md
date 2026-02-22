# Verve - React Markdown Editor (Demo Mode)

A powerful markdown documentation editor with live preview and intuitive navigation, now running in pure React for GitHub Pages deployment.

## 🚀 Demo Mode Features

- ✅ Pure React application (converted from Next.js)
- ✅ localStorage-based file system for demo files
- ✅ Sample markdown files included
- ✅ Full CRUD operations on demo files
- ✅ Fresh demo content on page reload
- ✅ Deployable to GitHub Pages

## 🏃 Running Locally

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

## 📦 Deployment to GitHub Pages

1. Update the `base` path in `vite.config.ts` to match your repository name:
   ```typescript
   base: '/your-repo-name/',
   ```

2. Update the `basename` in `src/main.tsx`:
   ```typescript
   <BrowserRouter basename="/your-repo-name">
   ```

3. Push to GitHub and enable GitHub Pages in repository settings (deploy from Actions)

4. The GitHub Action will automatically build and deploy on push to main

## 🗂️ Demo Files

Demo files are loaded from `public/content/` on initialization and stored in localStorage. The demo includes:

- Basic formatting examples
- Lists and tasks
- Code blocks
- Tables and quotes
- Collapsible sections
- Mermaid diagrams
- Advanced features
- Link navigation

## 🔧 Tech Stack

- **React** 19.2.3
- **Vite** 6.0.11
- **React Router** 7.1.3
- **TypeScript** 5
- **Tailwind CSS** 4
- **Zustand** 5.0.10
- **CodeMirror** 6
- **react-markdown** with remark-gfm

## 📝 Key Changes from Next.js

- Removed Next.js App Router → React Router
- Removed server-side APIs → Demo adapter with localStorage
- Removed NextAuth → Simplified demo-only UI
- Removed GrowthBook → Static configuration
- Added Vite for bundling and dev server

## 🎯 Usage

The demo mode automatically:
1. Loads sample files from `/public/content/` on first visit
2. Stores them in browser localStorage
3. Allows full editing (changes persist in localStorage)
4. Resets to fresh samples on page reload/refresh

## 📄 License

MIT

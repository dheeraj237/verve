# Quick Start Guide - Verve Demo Mode

## 🚀 Running the Application

### Development Mode
```bash
yarn dev
```
Access at: http://localhost:3000/verve/

### Production Build
```bash
yarn build
yarn preview
```

## 📦 Deploying to GitHub Pages

### One-Time Setup

1. **Update base paths** (if repo name is not "verve"):

   **vite.config.ts:**
   ```typescript
   base: '/your-repo-name/',
   ```

   **src/main.tsx:**
   ```typescript
   <BrowserRouter basename="/your-repo-name">
   ```

2. **Enable GitHub Pages:**
   - Repository Settings → Pages
   - Source: **GitHub Actions**

3. **Push to deploy:**
   ```bash
   git add .
   git commit -m "Deploy React version"
   git push origin main
   ```

4. **Access your app:**
   ```
   https://your-username.github.io/your-repo-name/
   ```

## 🎯 How Demo Mode Works

### File Loading
- Sample files loaded from `/public/content/` on startup
- Stored in browser localStorage
- Full editing capabilities
- Fresh copy on every page reload

### Supported Operations
- ✅ Create files
- ✅ Read files
- ✅ Update files
- ✅ Delete files
- ✅ Navigate folders
- ✅ Search content

### Data Persistence
- Changes save to localStorage automatically
- Survives browser restarts
- Resets to fresh samples on page reload
- No server required

## 📁 Adding More Sample Files

1. Add markdown files to `public/content/`
2. Update `demo-adapter.ts`:
   ```typescript
   private sampleFiles = [
     { path: '/your-new-file.md', category: 'samples' },
     // ...
   ];
   ```
3. Rebuild and deploy

## 🔧 Customization

### Change Repository Name
1. Update `vite.config.ts` → `base`
2. Update `src/main.tsx` → `basename`
3. Rebuild

### Add Custom Features
- Edit `src/App.tsx` for routing
- Add pages in `src/pages/`
- Extend `demo-adapter.ts` for new storage features

### Style Changes
- All styles in Tailwind (no custom CSS needed)
- Theme system: `shared/components/theme-provider.tsx`
- Colors: `app/globals.css` CSS variables

## 🐛 Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist .next
yarn install
yarn build
```

### Files Not Loading
- Check browser console for errors
- Verify files exist in `public/content/`
- Check localStorage isn't full

### GitHub Pages 404
- Ensure `.nojekyll` file exists in `public/`
- Verify `base` path matches repo name
- Check GitHub Actions logs

## 📊 Bundle Size

Current build:
- Main bundle: ~1.2MB (gzipped: ~413KB)
- Includes: React, Router, CodeMirror, Mermaid, KaTeX
- Most weight from math/diagram libraries (necessary for features)

## 🎨 Tech Stack

- **React** 19.2.3
- **Vite** 6.0.11  
- **React Router** 7.1.3
- **Zustand** 5.0.10 (state)
- **Tailwind CSS** 4
- **CodeMirror** 6
- **Mermaid** 11+ (diagrams)
- **KaTeX** (math)

## ✅ Verification Checklist

Before deploying:
- [ ] `yarn build` succeeds
- [ ] `yarn preview` works locally
- [ ] Demo files load in browser
- [ ] File operations work
- [ ] Theme switching works  
- [ ] GitHub Actions workflow exists
- [ ] Repository name matches config

## 🎉 You're Ready!

Your markdown editor is now:
- Pure client-side React app
- Deployable to GitHub Pages
- Demo mode with localStorage
- No backend required

**Next:** `git push` and watch it deploy automatically!

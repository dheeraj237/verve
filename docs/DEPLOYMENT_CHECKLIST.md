# Pre-Deployment Checklist

## ⚠️ IMPORTANT: Complete Before First Deployment

### 1. Update Repository Configuration

**Location**: `vite.config.ts`

```typescript
export default defineConfig({
  // ... other config
  base: '/YOUR_ACTUAL_REPO_NAME/', // ⚠️ CHANGE THIS!
  // ...
});
```

**Location**: `src/main.tsx`

```typescript
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/YOUR_ACTUAL_REPO_NAME"> {/* ⚠️ CHANGE THIS! */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

**Example:** If your repo is `https://github.com/username/markdown-editor`:
- Use: `base: '/markdown-editor/',`
- Use: `basename="/markdown-editor"`

---

### 2. Verify Sample Files

Check that these files exist in `public/content/`:
- [ ] `01-basic-formatting.md`
- [ ] `02-lists-and-tasks.md`
- [ ] `03-code-blocks.md`
- [ ] `04-tables-and-quotes.md`
- [ ] `05-collapsable-sections.md`
- [ ] `06-mermaid-diagrams.md`
- [ ] `07-advanced-features.md`
- [ ] `08-link-navigation.md`

---

### 3. Enable GitHub Pages

1. Go to: `https://github.com/USERNAME/REPO_NAME/settings/pages`
2. Set **Source** to: `GitHub Actions`
3. Save

---

### 4. Test Locally

```bash
# Build the app
yarn build

# Test the build
yarn preview

# Open: http://localhost:4173/YOUR_REPO_NAME/
# (Note: Use repo name in URL)
```

**Test These:**
- [ ] Landing page loads
- [ ] Can navigate to `/editor`
- [ ] File tree shows sample files
- [ ] Can open and edit files
- [ ] Can create new files
- [ ] Theme toggle works
- [ ] All markdown renders correctly

---

### 5. Update README (Optional)

Edit the GitHub link in `shared/components/user-menu.tsx`:

```typescript
<a 
  href="https://github.com/YOUR_USERNAME/YOUR_REPO_NAME"  // ⚠️ CHANGE THIS!
  target="_blank" 
  rel="noopener noreferrer"
>
```

---

### 6. Deploy

```bash
git add .
git commit -m "Convert to React with demo mode"
git push origin main
```

**Monitor deployment:**
1. Go to Actions tab in GitHub
2. Watch the build/deploy workflow
3. Wait for ✅ green checkmark

---

### 7. Verify Deployment

After GitHub Actions completes (~2-3 minutes):

1. Visit: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`
2. Test:
   - [ ] Landing page loads
   - [ ] Click "Try Demo" button
   - [ ] Files load in explorer
   - [ ] Can edit files
   - [ ] Changes persist (before reload)
   - [ ] Reload resets to fresh files

---

## 📝 Quick Reference

### Local Development
```bash
yarn dev              # http://localhost:3000/verve/
```

### Build & Preview
```bash
yarn build            # Creates dist/
yarn preview          # http://localhost:4173/verve/
```

### Deploy
```bash
git push origin main  # Auto-deploys via GitHub Actions
```

---

## 🚨 Common Issues

### Issue: 404 on GitHub Pages
**Fix:** Verify `base` path in `vite.config.ts` matches your repo name exactly

### Issue: Blank page after deployment
**Fix:** Check browser console, ensure `basename` in `src/main.tsx` is correct

### Issue: "Failed to fetch" errors
**Fix:** Files in `public/` are case-sensitive on GitHub Pages

### Issue: Actions failing to deploy
**Fix:** Ensure Pages is set to "GitHub Actions" source, not "branch"

---

## ✅ Ready to Deploy?

Before pushing:
- [ ] Updated `base` in `vite.config.ts`
- [ ] Updated `basename` in `src/main.tsx`
- [ ] Tested with `yarn build && yarn preview`
- [ ] Enabled GitHub Pages (Actions source)
- [ ] Committed all changes

**Then run:**
```bash
git push origin main
```

**Your app will be live at:**
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

---

## 🎉 After Deployment

Share your demo editor:
- URL: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`
- All features work client-side only
- No server needed
- Free hosting on GitHub

---

## 📊 What Users Get

✅ Live markdown editor
✅ Sample files to explore
✅ Full editing capabilities
✅ Dark/light theme
✅ Mermaid diagrams
✅ Code highlighting
✅ Math rendering (KaTeX)
✅ Table of contents
✅ File management

All running in the browser!

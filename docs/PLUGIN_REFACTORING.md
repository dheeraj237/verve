# Plugin Refactoring Summary

## Changes Made

### 1. Created Shared Utility File
**File**: `/features/editor/plugins/plugin-utils.ts`

Created a centralized utility file with reusable functions for all plugins:

- `hasSelectionOverlap()` - Check if selection overlaps with widget range (ViewPlugin version)
- `hasSelectionOverlapState()` - Check if selection overlaps with widget range (StateField version)
- `shouldShowWidgetSource()` - Determine if source should be shown (ViewPlugin version)
- `shouldShowWidgetSourceState()` - Determine if source should be shown (StateField version)
- `sanitizeHTML()` - Remove dangerous HTML attributes (script tags, event handlers)
- `containsMarkdown()` - Detect if HTML contains markdown syntax (code blocks, lists, headings)

### 2. Updated HTML Plugin
**File**: `/features/editor/plugins/html-plugin.tsx`

- ✅ Uses `shouldShowWidgetSourceState()` to properly show source on selection
- ✅ Uses `sanitizeHTML()` and `containsMarkdown()` utilities
- ✅ Skips HTML blocks containing markdown syntax (prevents crashes)
- ✅ Proper selection handling - shows source when text is selected
- ✅ Details/summary accordion functionality working

### 3. Updated Mermaid Plugin
**File**: `/features/editor/plugins/mermaid-plugin.tsx`

- ✅ Uses `shouldShowWidgetSourceState()` for consistent selection handling
- ✅ Shows source when clicking on diagram
- ✅ **Fixed**: When moving caret within the same code block, it now maintains the view (doesn't re-render constantly)
- ✅ Only rebuilds decorations on document change, config change, or selection change

### 4. Updated Code Block Plugin
**File**: `/features/editor/plugins/code-block-plugin.tsx`

- ✅ Uses `shouldShowWidgetSourceState()` for consistent selection handling
- ✅ Shows source when clicking on code block
- ✅ **Fixed**: When moving caret within the same code block, it now maintains the view
- ✅ Proper selection overlap checking

### 5. Enabled HTML Plugin
**File**: `/features/editor/components/live-markdown-editor.tsx`

- ✅ Enabled `htmlPlugin` in the editor configuration (was commented out)

## Key Improvements

### Selection Handling
All plugins now use the same pattern for showing source:
1. Check `shouldShowSource()` - cursor/selection inside the widget
2. Check `hasSelectionOverlap()` - selection extends into the widget
3. Show source if either condition is true

### No Re-rendering Within Same Block
**Before**: Moving the caret within a code block or mermaid diagram would constantly re-render
**After**: The widget stays rendered as long as the selection stays within the block, only showing source when you click to edit or select text

### Code Reusability
- Shared utility functions reduce code duplication
- Consistent behavior across all plugins
- Easier to maintain and extend

### HTML Plugin Safety
- Properly filters out HTML blocks with markdown content
- Prevents crashes when loading files like `html-examples.md`
- Only renders pure HTML blocks

## Testing Recommendations

1. **HTML Plugin**:
   - Load `html-examples.md` - should not crash
   - Simple HTML divs should render
   - Clicking on rendered HTML should show source
   - Details/summary accordion should toggle on summary click

2. **Mermaid Plugin**:
   - Click on rendered diagram - shows source
   - Move caret around within the code block - stays in source view
   - Click outside code block - re-renders diagram

3. **Code Block Plugin**:
   - Click on rendered code block - shows source
   - Move caret around within the code block - stays in source view
   - Click outside code block - re-renders with syntax highlighting

4. **Selection Handling**:
   - Select text that includes part of a widget - shows source
   - Click directly on widget - shows source
   - Click outside widget - renders widget

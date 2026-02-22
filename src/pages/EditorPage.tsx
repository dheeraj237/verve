/**
 * Editor Page - Main application interface with file explorer and markdown editor
 * Demo mode version using localStorage
 */
import { AppShell } from '@/shared/components/app-shell';
import { Editor } from '@/features/editor/components/unified-editor';

export function EditorPage() {
  return (
    <AppShell>
      <Editor />
    </AppShell>
  );
}

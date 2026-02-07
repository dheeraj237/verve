/**
 * Main application page - Composes the VSCode-like interface
 * Uses AppShell for 3-panel layout and Editor for content area
 */
"use client";

import { AppShell } from "@/shared/components/app-shell";
import { Editor } from "@/features/editor/components/unified-editor";

export default function Home() {
  return (
    <AppShell>
      <Editor />
    </AppShell>
  );
}

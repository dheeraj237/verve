import { AppShell } from "@/shared/components/app-shell";
import { MarkdownPreview } from "@/features/markdown-preview/components/markdown-preview";

export default function Home() {
  return (
    <AppShell>
      <MarkdownPreview />
    </AppShell>
  );
}

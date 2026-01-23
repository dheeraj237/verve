import { Feature } from "@/shared/types";

export const features: Record<string, Feature> = {
  fileExplorer: {
    id: "file-explorer",
    name: "File Explorer",
    version: "1.0.0",
    enabled: true,
  },
  markdownPreview: {
    id: "markdown-preview",
    name: "Markdown Preview",
    version: "1.0.0",
    enabled: true,
  },
  markdownEditor: {
    id: "markdown-editor",
    name: "Markdown Editor",
    version: "1.0.0",
    enabled: true,
  },
  roadmapTracker: {
    id: "roadmap-tracker",
    name: "Roadmap Tracker",
    version: "0.5.0",
    enabled: true,
    experimental: true,
  },
  searchFeature: {
    id: "search",
    name: "Search",
    version: "0.8.0",
    enabled: false,
  },
  aiAssistant: {
    id: "ai-assistant",
    name: "AI Assistant",
    version: "0.1.0",
    enabled: false,
    experimental: true,
  },
} as const;

export function isFeatureEnabled(featureId: keyof typeof features): boolean {
  return features[featureId]?.enabled ?? false;
}

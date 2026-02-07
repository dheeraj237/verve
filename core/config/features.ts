import { Feature } from "@/shared/types";

/**
 * Feature Flag Management System
 * 
 * This system provides centralized control over application features.
 * Features can be toggled on/off at runtime and integrates with third-party
 * services like GrowthBook for A/B testing and gradual rollouts.
 * 
 * To integrate with GrowthBook or similar services:
 * 1. Add the SDK as a dependency
 * 2. Create a provider in core/config/feature-flag-provider.tsx
 * 3. Override feature flags using the provider's context
 */

export const features: Record<string, Feature> = {
  fileExplorer: {
    id: "file-explorer",
    name: "File Explorer",
    version: "1.0.0",
    enabled: true,
    description: "Tree-based file navigation with search and filtering",
  },
  markdownEditor: {
    id: "markdown-editor",
    name: "Markdown Editor & Preview",
    version: "1.0.0",
    enabled: true,
    description: "Unified markdown editor with live preview, TOC, and support for Mermaid diagrams",
  },
  mermaidDiagrams: {
    id: "mermaid-diagrams",
    name: "Mermaid Diagram Support",
    version: "0.8.0",
    enabled: false,
    experimental: true,
    description: "Render Mermaid diagrams in preview and editor modes",
  },
  tableOfContents: {
    id: "table-of-contents",
    name: "Table of Contents",
    version: "1.0.0",
    enabled: true,
    description: "Auto-generated TOC with scroll sync and navigation",
  },
  roadmapTracker: {
    id: "roadmap-tracker",
    name: "Roadmap Tracker",
    version: "0.5.0",
    enabled: false,
    experimental: true,
    description: "Development roadmap visualization",
  },
  searchFeature: {
    id: "search",
    name: "Search",
    version: "0.1.0",
    enabled: false,
    experimental: true,
    description: "Full-text search across all markdown files",
  },
  aiAssistant: {
    id: "ai-assistant",
    name: "AI Assistant",
    version: "0.1.0",
    enabled: false,
    experimental: true,
    description: "AI-powered writing and editing assistance",
  },
} as const;

/**
 * Check if a feature is enabled
 * @param featureId - The feature identifier
 * @returns true if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(featureId: keyof typeof features): boolean {
  const feature = features[featureId];
  if (!feature) return false;

  // In development, experimental features can be enabled
  const isDev = process.env.NODE_ENV === "development";
  if (feature.experimental && !isDev && !feature.enabled) {
    return false;
  }

  return feature.enabled ?? false;
}

/**
 * Get feature configuration
 * @param featureId - The feature identifier
 * @returns The feature configuration or undefined
 */
export function getFeature(featureId: keyof typeof features): Feature | undefined {
  return features[featureId];
}

/**
 * Get all enabled features
 * @returns Array of enabled features
 */
export function getEnabledFeatures(): Feature[] {
  return Object.values(features).filter((feature) =>
    isFeatureEnabled(feature.id as keyof typeof features)
  );
}

/**
 * Runtime feature flag override (for testing/debugging)
 * Use with caution - this mutates the features object
 */
export function setFeatureEnabled(
  featureId: keyof typeof features,
  enabled: boolean
): void {
  if (features[featureId]) {
    features[featureId].enabled = enabled;
  }
}


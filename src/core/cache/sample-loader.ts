/**
 * Sample Loader
 *
 * Loads markdown sample files from `public/content` into the given workspace
 * using the file-manager API. Designed to be browser-friendly (uses fetch)
 * and test-friendly (tests can mock global.fetch).
 */

import { saveFile } from './file-manager';
import { WorkspaceType } from './types';

const sampleFiles = [
  { path: '/01-basic-formatting.md', name: '01-basic-formatting.md' },
  { path: '/02-lists-and-tasks.md', name: '02-lists-and-tasks.md' },
  { path: '/03-code-blocks.md', name: '03-code-blocks.md' },
  { path: '/04-tables-and-quotes.md', name: '04-tables-and-quotes.md' },
  { path: '/05-collapsable-sections.md', name: '05-collapsable-sections.md' },
  { path: '/06-mermaid-diagrams.md', name: '06-mermaid-diagrams.md' },
  { path: '/07-advanced-features.md', name: '07-advanced-features.md' },
  { path: '/08-link-navigation.md', name: '08-link-navigation.md' },
  { path: '/content1/test-feature-link-navigation.md', name: 'test-feature-link-navigation.md' },
  { path: '/notes-101/notes.md', name: 'notes.md' },
];

export async function loadSamplesIntoWorkspace(workspaceId: string = 'verve-samples'): Promise<void> {
  for (const sample of sampleFiles) {
    try {
      // Browser-only fetch from public/content
      // Use import.meta.env.BASE_URL to handle custom base paths in production
      const contentUrl = new URL(`content${sample.path}`, import.meta.env.BASE_URL).href;
      const res = await fetch(contentUrl);
      if (!res.ok) {
        console.warn(`[sample-loader] failed to fetch ${sample.path}: ${res.status}`);
        continue;
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) {
        console.warn(`[sample-loader] skipping ${sample.path} due to html response`);
        continue;
      }
      const content = await res.text();

      // Save into workspace via file-manager
      // Note: `saveFile` expects a workspaceType and workspaceId. We pass Browser here
      // because sample workspaces are browser-scoped. Tests running in Node should
      // mock `fetch` and the file-manager functions as needed.
      await saveFile(sample.path, content, WorkspaceType.Browser as any, undefined, workspaceId);
    } catch (e) {
      console.warn(`[sample-loader] error loading ${sample.path}:`, e);
    }
  }
}

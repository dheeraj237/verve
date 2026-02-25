import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables for the current mode (including .env, .env.production, etc.)
  const env = loadEnv(mode, process.cwd(), '');
  // Use VITE_BASE_PATH when provided, otherwise default to '/' (dev)
  const base = env.VITE_BASE_PATH || '/';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  // For GitHub Pages: set to '/repo-name/' for project pages, or '/' for user/org pages
    // Defaults to '/' for local development. Provide VITE_BASE_PATH to override.
    base,
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          // Split large vendor libraries into separate chunks to
          // reduce the main bundle size and make caching more effective.
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('mermaid')) return 'vendor_mermaid';
              if (id.includes('cytoscape')) return 'vendor_cytoscape';
              if (id.includes('katex')) return 'vendor_katex';
              if (id.includes('treemap') || id.includes('d3') || id.includes('dagre')) return 'vendor_diagrams';
              // fallback vendor chunk
              return 'vendor';
            }
          },
        },
      },
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});

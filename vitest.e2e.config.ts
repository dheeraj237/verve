import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './src/setupIndexedDBEnv.ts',
      './src/setupIntegrationEnv.ts',
      './src/setupNodeEnv.ts',
      './src/setupTests.ts',
      './src/setupIntegrationUnmock.ts',
    ],
    // Match E2E tests
    include: [
      'src/**/*.e2e.test.ts',
      'src/**/*.e2e.test.tsx',
    ],
    exclude: ['**/node_modules/**'],
    testTimeout: 10000,
    teardownTimeout: 5000,
  },
});

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
    environment: 'node',
    setupFiles: ['./src/setupIndexedDBEnv.ts', './src/setupUnitMocks.ts', './src/setupTests.ts'],
    // Match unit tests (excludes integration and e2e)
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/*.integration.test.ts', '**/*.integration.test.tsx', '**/*.e2e.test.ts', '**/*.e2e.test.tsx'],
    testTimeout: 10000,
    teardownTimeout: 5000,
  },
});



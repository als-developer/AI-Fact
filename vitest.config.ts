import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        DB: 'D1Database',
        CACHE: 'KVNamespace',
        DOCUMENTS: 'R2Bucket',
        JOB_QUEUE: 'Queue',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.test.ts', '**/__tests__/**'],
    },
    testTimeout: 30000,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});

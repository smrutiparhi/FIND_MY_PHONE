import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Database tests share one real Postgres connection pool and truncate
    // between tests (see tests/setup.ts) - running files in parallel workers
    // would race on that shared state.
    fileParallelism: false,
  },
});

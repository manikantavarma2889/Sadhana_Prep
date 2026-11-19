import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['backend/tests/**/*.test.ts', 'frontend/src/**/*.test.tsx'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});

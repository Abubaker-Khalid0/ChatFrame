import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    // jsdom suites flake the 5s default under full-monorepo parallel load on
    // slower machines (010 hardening); 20s still catches genuine hangs.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});

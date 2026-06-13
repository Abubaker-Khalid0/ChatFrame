import { defineConfig } from 'vitest/config';

/**
 * Backend test runner config. Many backend tests build the full Fastify app
 * and perform real disk I/O (NDJSON streaming, export archives); under
 * full-suite parallel load the 5s default timeout flakes on slower machines
 * (010 hardening). 20s still catches genuine hangs.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});

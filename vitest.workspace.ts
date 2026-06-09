import { defineWorkspace } from 'vitest/config';

// Root workspace runner. Each package is discovered via its own Vitest config.
// `pnpm test` at the root runs all package suites together (FR-015 / SC-005).
export default defineWorkspace(['packages/*', 'backend', 'frontend']);

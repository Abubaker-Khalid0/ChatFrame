import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DEFAULT_BACKEND_PORT, DEFAULT_FRONTEND_PORT } from '@chatframe/shared';

// Load the repo-root .env (this file lives at backend/src/config/env.ts, so the
// repository root is three levels up). Values may be configured without
// changing source code (FR-009).
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BACKEND_PORT: z.coerce.number().int().positive().default(DEFAULT_BACKEND_PORT),
  FRONTEND_PORT: z.coerce.number().int().positive().default(DEFAULT_FRONTEND_PORT),
  VITE_BACKEND_URL: z.string().url().default(`http://localhost:${DEFAULT_BACKEND_PORT}`),
  // Root directory for local project data (FR-022). Defaults to ./chatframe-data
  // relative to the app's working directory; overridable for power users and
  // CI/test scenarios. The projects/ subdirectory is created automatically.
  WORKSPACE_DIR: z.string().min(1).default('./chatframe-data'),
  // Directory holding WhatsApp session files (FR-012, Constitution XIII).
  // Lives outside projects/ — session files never appear in exports or logs.
  SESSION_DIR: z.string().min(1).default('./chatframe-data/sessions'),
  // Toggles the synthetic mock adapter without any source change (FR-015).
  // Only the literal string "true" (case-insensitive) enables mock mode; any
  // other value — including unset — resolves to `false`.
  MOCK_MODE: z
    .string()
    .optional()
    .transform((value) => value?.toLowerCase() === 'true'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Boundary validation (Constitution XIV). Print a clear, non-sensitive message.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  /** Allowed frontend dev origin for CORS (FR-008). */
  frontendOrigin: `http://localhost:${data.FRONTEND_PORT}`,
} as const;

export type Env = typeof env;

import { z } from 'zod';

/**
 * Readiness status reported by the backend and consumed by the frontend
 * (see specs/.../contracts/health.md). Owned by @chatframe/shared so both
 * sides cannot diverge (FR-012). Validated at the frontend boundary
 * (Constitution XIV).
 */
export const HealthStatusSchema = z.object({
  status: z.literal('ok'),
  service: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

import { z } from 'zod';

/**
 * Normalization run-state contracts (see contracts/normalization.md, FR-020).
 * A single run is active per project at a time; the backend tracks state in an
 * in-memory registry and exposes it through the normalization API.
 */

/** Lifecycle state of a project's normalization run. */
export const NormalizationStateSchema = z.enum(['idle', 'running', 'completed', 'failed']);
export type NormalizationState = z.infer<typeof NormalizationStateSchema>;

/**
 * Current run status, returned by `GET .../normalization/status`. `error` is a
 * user-safe message when `state` is `failed` — it never contains message
 * content, tokens, or secrets (FR-023).
 */
export const NormalizationStatusSchema = z.object({
  projectId: z.string().min(1),
  state: NormalizationStateSchema,
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  currentStep: z.string().nullable(),
  error: z.string().nullable(),
});
export type NormalizationStatus = z.infer<typeof NormalizationStatusSchema>;

/** Response body for `POST .../normalize` (`202 Accepted`). */
export const NormalizeRunResponseSchema = z.object({
  projectId: z.string().min(1),
  state: NormalizationStateSchema,
  startedAt: z.string().datetime(),
  currentStep: z.string().nullable(),
});
export type NormalizeRunResponse = z.infer<typeof NormalizeRunResponseSchema>;

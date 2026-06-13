import type { z } from 'zod';
import type {
  HealthCheckResultSchema,
  SessionStatusSchema,
  SsePingEventSchema,
  SseSessionQrEventSchema,
  SseSessionStateEventSchema,
} from '../schemas/session';

/**
 * Session types inferred from the Zod schemas in `schemas/session.ts` —
 * co-derived to guarantee zero drift (Constitution XIV).
 */

/** Response body of the session REST endpoints (status/connect/logout). */
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/** Result of the Chromium/Puppeteer health check (FR-024). */
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

/** SSE `session.state` event payload. */
export type SseSessionStateEvent = z.infer<typeof SseSessionStateEventSchema>;

/** SSE `session.qr` event payload. */
export type SseSessionQrEvent = z.infer<typeof SseSessionQrEventSchema>;

/** SSE `ping` heartbeat event payload. */
export type SsePingEvent = z.infer<typeof SsePingEventSchema>;

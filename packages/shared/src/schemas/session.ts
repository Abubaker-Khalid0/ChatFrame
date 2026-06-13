import { z } from 'zod';
import { ConnectionStateSchema } from './connection';

/**
 * Session lifecycle schemas (see specs/005 data-model.md and
 * contracts/session-api.md). Owned by @chatframe/shared so the backend and
 * frontend cannot diverge on the session API payloads (Constitution XIV).
 */

/** Result of the Chromium/Puppeteer startup health check (FR-024). */
export const HealthCheckResultSchema = z.object({
  /** Whether Chromium is available and can be launched. */
  available: z.boolean(),
  /** ISO 8601 timestamp of the last health check. */
  checkedAt: z.string().datetime(),
  /** Diagnostic error message (for developer debugging), or `null`. */
  error: z.string().nullable(),
});

/**
 * Current state of the WhatsApp session, returned by `GET /api/session/status`
 * and the connect/logout endpoints.
 */
export const SessionStatusSchema = z.object({
  state: ConnectionStateSchema,
  /** Whether a silent session restore attempt is in progress (FR-008). */
  isRestoring: z.boolean(),
  healthCheck: HealthCheckResultSchema,
  /** ISO 8601 timestamp when the connection was established, or `null`. */
  connectedAt: z.string().datetime().nullable(),
  /** User-friendly error message when in a failed state, or `null`. */
  error: z.string().nullable(),
});

/** Payload of the SSE `session.state` event (emitted on every transition). */
export const SseSessionStateEventSchema = z.object({
  state: ConnectionStateSchema,
  error: z.string().nullable(),
});

/** Payload of the SSE `session.qr` event (QR generated or refreshed, FR-004). */
export const SseSessionQrEventSchema = z.object({
  /** QR code data string, rendered client-side. Never logged (FR-013). */
  qr: z.string().min(1),
  /** Seconds until this QR code expires and a new one is generated. */
  expiresIn: z.number().int().positive(),
});

/** Payload of the SSE `ping` heartbeat event (sent every 30 seconds). */
export const SsePingEventSchema = z.object({
  timestamp: z.string().datetime(),
});

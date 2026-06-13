import { z } from 'zod';

/**
 * Connection lifecycle states for the messaging adapter (see data-model.md).
 * Owned by @chatframe/shared so the backend and frontend cannot diverge
 * (FR-003). The inferred type is co-located with the schema to guarantee
 * zero drift (Constitution XIV).
 */
export const ConnectionStateSchema = z.enum([
  'disconnected',
  'initializing',
  'waiting_for_qr',
  'qr_ready',
  'connecting',
  'connected',
  'session_expired',
  'connection_failed',
]);

export type ConnectionState = z.infer<typeof ConnectionStateSchema>;

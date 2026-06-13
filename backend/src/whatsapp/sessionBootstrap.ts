import type { FastifyInstance } from 'fastify';
import { eventManager } from '../api/sse/eventManager';
import { createWhatsappLogger } from '../config/logger';
import { assertSessionDirIsolated } from '../security/sessionProtection';
import { setAdapterCreatedHook, setAdapterLogger } from './adapterFactory';

/**
 * Wires the adapter callbacks to the SSE broadcast channel (FR-005, FR-011):
 * every `ConnectionState` transition becomes a `session.state` event and
 * every QR code a `session.qr` event, delivered to all connected tabs
 * (FR-023). Registered as a factory hook so re-created adapter instances
 * (e.g. after logout) are wired automatically.
 */
export function bootstrapSessionEvents(app: FastifyInstance): void {
  // A misconfigured SESSION_DIR overlapping project storage fails at startup,
  // not at export time (FR-019, Constitution XIX).
  assertSessionDirIsolated();

  setAdapterLogger(createWhatsappLogger(app.log));

  setAdapterCreatedHook((adapter) => {
    adapter.onStateChange((state, error) => {
      eventManager.broadcast('session.state', { state, error });
    });
    adapter.onQr((qr, expiresIn) => {
      // QR codes travel only on the SSE stream — never into logs (FR-004).
      eventManager.broadcast('session.qr', { qr, expiresIn });
    });
  });
}

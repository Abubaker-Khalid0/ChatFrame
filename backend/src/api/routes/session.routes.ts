import type { FastifyInstance } from 'fastify';
import { SessionStatusSchema, type HealthCheckResult, type SessionStatus } from '@chatframe/shared';
import { clearAdapter, getAdapter } from '../../whatsapp/adapterFactory';
import { runHealthCheck } from '../../whatsapp/healthCheck';
import { tryAcquireSessionLock } from '../../whatsapp/sessionLock';
import * as sessionStore from '../../whatsapp/sessionStore';
import { assertSessionDirEmpty } from '../../security/sessionProtection';
import { eventManager } from '../sse/eventManager';
import type { WhatsAppAdapter } from '../../whatsapp/WhatsAppAdapter';

/** Contract error messages (contracts/session-api.md). */
const MSG_ACTION_IN_PROGRESS = 'A session action is already in progress. Please wait.';
const MSG_CHROMIUM_UNAVAILABLE = 'WhatsApp integration could not start. Chromium is not available.';

/**
 * Session REST endpoints (FR-007, FR-009, FR-010; contracts/session-api.md):
 * `POST /api/session/connect`, `GET /api/session/status`, and
 * `POST /api/session/logout`. The Chromium health check runs on the first
 * status call (FR-024) and a saved session is restored automatically the
 * first time the connection screen asks for status (FR-008). Mutating
 * actions are serialized through the in-memory session lock (FR-023).
 */
export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // Per-process route state: health result cached after the first check (a
  // failed check is retried so the user can fix Chromium without a restart),
  // and restore is attempted at most once per backend lifetime.
  let cachedHealth: HealthCheckResult | null = null;
  let restoreAttempted = false;

  async function getHealth(): Promise<HealthCheckResult> {
    if (cachedHealth === null || !cachedHealth.available) {
      cachedHealth = await runHealthCheck();
    }
    return cachedHealth;
  }

  function buildStatus(adapter: WhatsAppAdapter, health: HealthCheckResult): SessionStatus {
    const info = adapter.getSessionInfo();
    // Outgoing payloads are validated at the boundary (Constitution XIV).
    return SessionStatusSchema.parse({
      state: adapter.getConnectionState(),
      isRestoring: info.isRestoring,
      healthCheck: health,
      connectedAt: info.connectedAt,
      error: info.error,
    });
  }

  app.get('/api/session/status', async () => {
    const adapter = getAdapter();
    const health = await getHealth();

    // Automatic silent restore on first status request (FR-008): only when a
    // saved session exists, the adapter is idle, and Chromium is available.
    if (!restoreAttempted) {
      restoreAttempted = true;
      if (
        health.available &&
        adapter.getConnectionState() === 'disconnected' &&
        (await sessionStore.sessionExists())
      ) {
        const release = tryAcquireSessionLock('restore');
        if (release !== null) {
          try {
            await adapter.initialize();
          } finally {
            release();
          }
        }
      }
    }

    return buildStatus(adapter, health);
  });

  app.post('/api/session/connect', async (_request, reply) => {
    const health = await getHealth();
    if (!health.available) {
      return reply.status(503).send({
        error: 'CHROMIUM_UNAVAILABLE',
        message: MSG_CHROMIUM_UNAVAILABLE,
      });
    }

    const release = tryAcquireSessionLock('connect');
    if (release === null) {
      return reply.status(409).send({
        error: 'SESSION_ACTION_IN_PROGRESS',
        message: MSG_ACTION_IN_PROGRESS,
      });
    }
    try {
      const adapter = getAdapter();
      await adapter.initialize();
      return buildStatus(adapter, health);
    } catch (error) {
      // initialize() reports launch failures through state events; a throw
      // here is unexpected — map it to a user-safe body (010 US1).
      app.log.error({ err: error }, 'session connect failed');
      return reply.status(500).send({
        error: 'CONNECTION_FAILED',
        message: 'Could not connect to WhatsApp. Check your internet and try again.',
      });
    } finally {
      release();
    }
  });

  app.post('/api/session/logout', async (_request, reply) => {
    const release = tryAcquireSessionLock('logout');
    if (release === null) {
      return reply.status(409).send({
        error: 'SESSION_ACTION_IN_PROGRESS',
        message: MSG_ACTION_IN_PROGRESS,
      });
    }
    try {
      const adapter = getAdapter();
      await adapter.logout();
      // Full teardown so the next connect starts from a fresh instance
      // (FR-010), then thorough session-file deletion (FR-018) verified by
      // the sessionProtection post-check — zero files remain (FR-019, SC-004).
      await clearAdapter();
      await sessionStore.clearSession();
      await assertSessionDirEmpty();

      // All tabs converge on `disconnected` (FR-014, FR-023, SC-011).
      eventManager.broadcast('session.state', { state: 'disconnected', error: null });

      return buildStatus(getAdapter(), await getHealth());
    } catch (error) {
      app.log.error({ err: error }, 'session logout failed');
      return reply.status(500).send({
        error: 'LOGOUT_FAILED',
        message: 'The session could not be fully unlinked. Please try again.',
      });
    } finally {
      release();
    }
  });
}

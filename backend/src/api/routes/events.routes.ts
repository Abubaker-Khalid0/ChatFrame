import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env';
import { getAdapter } from '../../whatsapp/adapterFactory';
import { getLastQr } from '../../whatsapp/sessionBootstrap';
import { eventManager, formatSseEvent } from '../sse/eventManager';

/**
 * `GET /api/events` — the Server-Sent Events stream (FR-011; research §4).
 * A single multiplexed endpoint carrying `session.state`, `session.qr`, and
 * `ping` events. Each connecting client immediately receives the current
 * connection state and QR (if available) as initial events, then all
 * broadcasts until it disconnects (per-client cleanup).
 */
export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/events', (request, reply) => {
    // The reply is hijacked: this response is a long-lived raw stream and
    // must bypass Fastify's serialization and onSend hooks (including CORS,
    // which is added manually below for the dev frontend origin).
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': env.frontendOrigin,
    });

    const adapter = getAdapter();
    const info = adapter.getSessionInfo();
    reply.raw.write(
      formatSseEvent('session.state', { state: adapter.getConnectionState(), error: info.error }),
    );

    // If a QR code is currently active, send it immediately so the client
    // does not have to wait for the next QR refresh cycle.
    const currentQr = getLastQr();
    if (currentQr !== null) {
      reply.raw.write(formatSseEvent('session.qr', currentQr));
    }

    const unregister = eventManager.addClient(reply.raw);
    request.raw.on('close', () => {
      unregister();
    });
  });
}

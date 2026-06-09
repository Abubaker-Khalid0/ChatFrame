import type { FastifyInstance } from 'fastify';
import type { HealthStatus } from '@chatframe/shared';

/**
 * Health endpoint (see contracts/health.md). Returns a schema-valid readiness
 * status. Local-only; no external network and no secrets logged
 * (Constitution I, XIX).
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (): Promise<HealthStatus> => {
    return {
      status: 'ok',
      service: 'chatframe-backend',
      timestamp: new Date().toISOString(),
    };
  });
}

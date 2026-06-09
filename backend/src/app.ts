import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { healthRoutes } from './api/routes/health.routes';

/**
 * Builds and configures the Fastify application. Kept as a factory so it can be
 * exercised in tests via `app.inject(...)` without binding a port.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            level: 'info',
            transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } },
          }
        : env.NODE_ENV === 'test'
          ? false
          : { level: 'info' },
  });

  // Allow the frontend dev origin to call the local service (FR-008).
  void app.register(cors, {
    origin: [env.frontendOrigin],
    methods: ['GET'],
  });

  // Routes.
  void app.register(healthRoutes);

  return app;
}

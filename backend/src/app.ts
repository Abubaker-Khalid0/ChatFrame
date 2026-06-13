import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { healthRoutes } from './api/routes/health.routes';
import { chatsRoutes } from './api/routes/chats.routes';
import { previewRoutes } from './api/routes/preview.routes';
import { mediaRoutes } from './api/routes/media.routes';
import { projectsRoutes } from './api/routes/projects.routes';
import { normalizationRoutes } from './api/routes/normalization.routes';
import { importRoutes } from './api/routes/import.routes';
import { exportRoutes } from './api/routes/export.routes';
import { shellRoutes } from './api/routes/shell.routes';
import { eventsRoutes } from './api/routes/events.routes';
import { sessionRoutes } from './api/routes/session.routes';
import { registerErrorHandler } from './api/errorHandler';
import { bootstrapSessionEvents } from './whatsapp/sessionBootstrap';

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

  // Safety net: any throw that escapes a route handler is mapped to a
  // structured, user-safe ApiErrorResponse (010 research §1).
  registerErrorHandler(app);

  // Allow the frontend dev origin to call the local service (FR-008).
  void app.register(cors, {
    origin: [env.frontendOrigin],
    methods: ['GET', 'POST', 'PATCH'],
  });

  // Adapter → SSE wiring must exist before any adapter instance is created
  // (FR-005, FR-011).
  bootstrapSessionEvents(app);

  // Routes.
  void app.register(healthRoutes);
  void app.register(chatsRoutes);
  void app.register(previewRoutes);
  // Image streaming for the preview (008 FR-003). GET is already in the CORS
  // allow-list above; <img> loads are not CORS-restricted in any case.
  void app.register(mediaRoutes);
  void app.register(projectsRoutes);
  void app.register(normalizationRoutes);
  void app.register(importRoutes);
  // HTML export generation (009 FR-001). POST is already in the CORS allow-list.
  void app.register(exportRoutes);
  // OS file-explorer opener, constrained to exports/ (009 FR-016/FR-027).
  void app.register(shellRoutes);
  void app.register(eventsRoutes);
  void app.register(sessionRoutes);

  return app;
}

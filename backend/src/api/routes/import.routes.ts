import type { FastifyInstance } from 'fastify';
import {
  StartImportRequestSchema,
  type CancelImportResponse,
  type StartImportResponse,
} from '@chatframe/shared';
import { env } from '../../config/env';
import { startImport } from '../../import/ImportOrchestrator';
import { ImportInProgressError, getProgress, requestCancel } from '../../import/importRegistry';
import { StorageError } from '../../utils/errors';
import { getAdapter } from '../../whatsapp/adapterFactory';
import { toValidationErrorBody } from '../errors';

/**
 * Import API (contracts/import-api.md): `POST /api/import/start`,
 * `GET /api/import/:importId/status`, `POST /api/import/:importId/cancel`
 * (FR-013–FR-015). Bodies are validated with the shared Zod schemas at the
 * boundary (FR-025); live progress is delivered over the existing
 * `GET /api/events` SSE stream, not by polling (FR-020).
 */

export async function importRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/import/start — begin a new import (202; 409 when one runs).
  app.post('/api/import/start', async (request, reply) => {
    const parsed = StartImportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(toValidationErrorBody(parsed.error));
    }

    const adapter = getAdapter();
    // The mock serves fixtures without a connect flow (contracts/chats-api.md);
    // the real adapter requires a live session before fetching (FR-003).
    if (!env.MOCK_MODE && adapter.getConnectionState() !== 'connected') {
      return reply.status(409).send({
        error: 'SESSION_NOT_CONNECTED',
        message: 'Connect WhatsApp before importing.',
      });
    }

    try {
      const handle = await startImport({ request: parsed.data, adapter });
      const body: StartImportResponse = {
        importId: handle.importId,
        projectId: handle.projectId,
        stage: 'preparing_project',
        startedAt: handle.startedAt,
      };
      return await reply.status(202).send(body);
    } catch (error) {
      if (error instanceof ImportInProgressError) {
        return reply.status(409).send({ error: error.code, message: error.message });
      }
      app.log.error(error);
      if (error instanceof StorageError) {
        return reply.status(500).send({ error: error.code, message: error.message });
      }
      return reply.status(500).send({
        error: 'STORAGE_ERROR',
        message: 'Failed to start the import',
      });
    }
  });

  // GET /api/import/:importId/status — live ImportProgress snapshot (FR-014).
  app.get<{ Params: { importId: string } }>(
    '/api/import/:importId/status',
    async (request, reply) => {
      const progress = getProgress(request.params.importId);
      if (progress === null) {
        return reply.status(404).send({
          error: 'IMPORT_NOT_FOUND',
          message: 'No import found for this id.',
        });
      }
      return reply.status(200).send(progress);
    },
  );

  // POST /api/import/:importId/cancel — cooperative cancellation (FR-015).
  app.post<{ Params: { importId: string } }>(
    '/api/import/:importId/cancel',
    async (request, reply) => {
      const { importId } = request.params;
      const progress = getProgress(importId);
      if (progress === null) {
        return reply.status(404).send({
          error: 'IMPORT_NOT_FOUND',
          message: 'No import found for this id.',
        });
      }

      // `false` means gracefully ignored: non-cancellable or terminal stage
      // (US4 AC-5). The authoritative transition to `cancelled` arrives on the
      // `import.completed` SSE event once the orchestrator reaches a boundary.
      const cancellationRequested = requestCancel(importId);
      const body: CancelImportResponse = {
        importId,
        stage: progress.stage,
        cancellationRequested,
      };
      return reply.status(200).send(body);
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { ChatsResponseSchema } from '@chatframe/shared';
import { getAdapter } from '../../whatsapp/adapterFactory';
import { sortByRecency } from '../../whatsapp/chatMapping';
import { SessionExpiredError, WhatsAppNotConnectedError } from '../../whatsapp/errors';
import { toValidationErrorBody } from '../errors';

/**
 * `GET /api/chats/private` — lists all private (one-to-one) chats from the
 * active adapter. Group chats are filtered out (Constitution III). A session
 * that is not connected yields a structured, machine-readable `409` so the
 * frontend can offer "reconnect" instead of "retry" (FR-006). The outgoing
 * payload is validated against the shared schema before it leaves the
 * boundary (Constitution XIV / FR-005).
 */
export async function chatsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/chats/private', async (_request, reply) => {
    try {
      const adapter = getAdapter();
      const chats = await adapter.listPrivateChats();
      // The recency order is part of the API contract, enforced at the
      // boundary regardless of adapter behavior (FR-007).
      const body = ChatsResponseSchema.parse({
        chats: sortByRecency(chats.filter((chat) => !chat.isGroup)),
      });
      return body;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        return reply.status(409).send({
          error: error.code,
          message: 'Your WhatsApp session has expired. Please scan the QR code again.',
        });
      }
      if (error instanceof WhatsAppNotConnectedError) {
        return reply.status(409).send({
          error: 'SESSION_NOT_CONNECTED',
          message: 'WhatsApp is not connected. Reconnect to view your chats.',
        });
      }
      app.log.error(error);
      if (error instanceof ZodError) {
        return reply
          .status(500)
          .send(toValidationErrorBody(error, 'Chat list failed schema validation'));
      }
      return reply.status(500).send({
        error: 'ADAPTER_ERROR',
        message: 'Failed to list chats from messaging adapter',
      });
    }
  });
}

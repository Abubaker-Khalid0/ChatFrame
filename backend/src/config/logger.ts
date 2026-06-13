import type { FastifyBaseLogger } from 'fastify';
import { sanitizeForLog } from '../security/sanitizeForLog';

/**
 * Creates the `whatsapp` log child with {@link sanitizeForLog} registered as a
 * Pino serializer (FR-013, research §8). Every payload logged under one of the
 * common object keys is sanitized automatically, and the `qr` key is always
 * redacted outright — QR codes never reach log output (Constitution XIII).
 */
export function createWhatsappLogger(base: FastifyBaseLogger): FastifyBaseLogger {
  return base.child(
    { module: 'whatsapp' },
    {
      serializers: {
        qr: () => '[REDACTED]',
        payload: sanitizeForLog,
        data: sanitizeForLog,
        event: sanitizeForLog,
        session: sanitizeForLog,
        details: sanitizeForLog,
        err: sanitizeForLog,
        error: sanitizeForLog,
      },
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import {
  ExportError,
  ManifestValidationError,
  MediaDownloadError,
  NormalizationError,
  ProjectNotFoundError,
  StorageError,
  type FieldIssue,
} from '../utils/errors';
import { AdapterError, SessionExpiredError, WhatsAppNotConnectedError } from '../whatsapp/errors';
import { formatZodIssues } from './errors';

/**
 * Centralized error handling (010 research §1, data-model §1.3/§1.4).
 *
 * Routes still map their domain errors explicitly; this handler is the safety
 * net for anything that escapes a route handler. Every unhandled throw is
 * mapped onto the structured `ApiErrorResponse` shape with a user-safe
 * message — never a raw stack trace, library internals, or message content
 * (Constitution XIX, FR-016).
 */

/** Structured error response shape returned by every API error (§1.4). */
export interface ApiErrorResponse {
  /** Machine-readable code (e.g. `SESSION_EXPIRED`). */
  error: string;
  /** User-safe message — never contains secrets or message content. */
  message: string;
  /** Optional per-field issues for validation failures. */
  details?: FieldIssue[];
}

/** A resolved mapping from a thrown error to an HTTP response. */
interface MappedError {
  status: number;
  body: ApiErrorResponse;
}

/**
 * Maps a thrown error to an HTTP status + user-safe body. Order matters:
 * subclasses are checked before their base classes (e.g. `ProjectNotFoundError`
 * before `StorageError`).
 */
export function mapErrorToResponse(error: unknown): MappedError {
  if (error instanceof ZodError) {
    return {
      status: 422,
      body: {
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: formatZodIssues(error),
      },
    };
  }

  if (error instanceof ProjectNotFoundError) {
    return {
      status: 404,
      body: { error: error.code, message: 'The requested project could not be found.' },
    };
  }

  if (error instanceof ManifestValidationError) {
    return {
      status: 400,
      body: {
        error: error.code,
        message: 'The project data is invalid or corrupted.',
        details: error.details,
      },
    };
  }

  if (error instanceof StorageError) {
    return {
      status: 500,
      body: {
        error: error.code,
        message: 'Could not write to the project folder. Check disk space or permissions.',
      },
    };
  }

  if (error instanceof ExportError) {
    return {
      status: 500,
      body: {
        error: error.code,
        message: 'The export could not be completed. Check disk space and try again.',
      },
    };
  }

  if (error instanceof NormalizationError) {
    return {
      status: 500,
      body: {
        error: error.code,
        message: 'Message processing encountered an error. Raw data is preserved.',
      },
    };
  }

  if (error instanceof MediaDownloadError) {
    return {
      status: 500,
      body: {
        error: error.code,
        message: 'Some images could not be downloaded. They will appear as placeholders.',
      },
    };
  }

  if (error instanceof WhatsAppNotConnectedError) {
    return {
      status: 409,
      body: {
        error: 'SESSION_NOT_CONNECTED',
        message: 'WhatsApp is not connected. Reconnect and try again.',
      },
    };
  }

  if (error instanceof SessionExpiredError) {
    return {
      status: 409,
      body: {
        error: error.code,
        message: 'Your WhatsApp session has expired. Please scan the QR code again.',
      },
    };
  }

  if (error instanceof AdapterError) {
    return {
      status: 500,
      body: {
        error: error.code,
        message: 'The WhatsApp integration failed unexpectedly. Please try again.',
      },
    };
  }

  // Fastify framework errors (body parse failures, bad content type, …) carry
  // a 4xx statusCode and a framework-authored message that is safe to expose.
  const statusCode =
    typeof error === 'object' && error !== null
      ? (error as { statusCode?: unknown }).statusCode
      : undefined;
  if (
    typeof statusCode === 'number' &&
    statusCode >= 400 &&
    statusCode < 500 &&
    error instanceof Error
  ) {
    return {
      status: statusCode,
      body: { error: 'BAD_REQUEST', message: error.message },
    };
  }

  // Unknown failure: generic, redaction-safe fallback (never the raw message).
  return {
    status: 500,
    body: { error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  };
}

/**
 * Registers the centralized error handler on the app. Full error details go to
 * the local log (Pino serializes the Error; messages in our taxonomy are
 * redaction-safe by construction); the client only ever sees the mapped body.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const { status, body } = mapErrorToResponse(error);
    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error mapped by central handler');
    } else {
      request.log.warn(
        { code: body.error, status, msg: error instanceof Error ? error.message : 'unknown' },
        'request error mapped by central handler',
      );
    }
    return reply.status(status).send(body);
  });
}

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ExportError,
  ManifestValidationError,
  MediaDownloadError,
  NormalizationError,
  ProjectNotFoundError,
  StorageError,
} from '../utils/errors';
import { AdapterError, SessionExpiredError, WhatsAppNotConnectedError } from '../whatsapp/errors';
import { mapErrorToResponse, registerErrorHandler } from './errorHandler';

/**
 * 010 T023 — error classification audit (contracts §1): the centralized
 * handler must map every taxonomy class to the correct HTTP status and a
 * user-safe message, and must never leak raw error internals.
 */

describe('mapErrorToResponse (010 data-model §1.2/§1.3)', () => {
  const cases: Array<{
    name: string;
    error: unknown;
    status: number;
    code: string;
  }> = [
    {
      name: 'ProjectNotFoundError → 404',
      error: new ProjectNotFoundError('proj-x'),
      status: 404,
      code: 'PROJECT_NOT_FOUND',
    },
    {
      name: 'ManifestValidationError → 400',
      error: new ManifestValidationError('bad manifest', [{ path: 'status', message: 'invalid' }]),
      status: 400,
      code: 'MANIFEST_VALIDATION_ERROR',
    },
    {
      name: 'StorageError → 500',
      error: new StorageError('disk failure at /secret/path'),
      status: 500,
      code: 'STORAGE_ERROR',
    },
    {
      name: 'ExportError → 500',
      error: new ExportError('template render blew up'),
      status: 500,
      code: 'EXPORT_ERROR',
    },
    {
      name: 'NormalizationError → 500',
      error: new NormalizationError('stage 3 failed'),
      status: 500,
      code: 'NORMALIZATION_ERROR',
    },
    {
      name: 'MediaDownloadError → 500',
      error: new MediaDownloadError('download failed', 'media-001'),
      status: 500,
      code: 'MEDIA_DOWNLOAD_ERROR',
    },
    {
      name: 'WhatsAppNotConnectedError → 409',
      error: new WhatsAppNotConnectedError(),
      status: 409,
      code: 'SESSION_NOT_CONNECTED',
    },
    {
      name: 'SessionExpiredError → 409',
      error: new SessionExpiredError(),
      status: 409,
      code: 'SESSION_EXPIRED',
    },
    {
      name: 'AdapterError → 500',
      error: new AdapterError('puppeteer internals leaked here'),
      status: 500,
      code: 'ADAPTER_ERROR',
    },
  ];

  it.each(cases)('$name with a user-safe message', ({ error, status, code }) => {
    const mapped = mapErrorToResponse(error);
    expect(mapped.status).toBe(status);
    expect(mapped.body.error).toBe(code);
    expect(mapped.body.message.length).toBeGreaterThan(0);
  });

  it('every taxonomy class maps to a distinct code', () => {
    const codes = cases.map(({ error }) => mapErrorToResponse(error).body.error);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('maps a ZodError to 422 with field-level details', () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 42 });
    expect(result.success).toBe(false);
    if (result.success) return;

    const mapped = mapErrorToResponse(result.error);
    expect(mapped.status).toBe(422);
    expect(mapped.body.error).toBe('VALIDATION_ERROR');
    expect(mapped.body.details).toEqual([{ path: 'name', message: expect.any(String) }]);
  });

  it('never leaks the thrown message for unknown errors (Constitution XIX)', () => {
    const mapped = mapErrorToResponse(new Error('ENOENT /home/user/.wwebjs_auth/token'));
    expect(mapped.status).toBe(500);
    expect(mapped.body.error).toBe('INTERNAL_ERROR');
    expect(mapped.body.message).not.toContain('wwebjs');
    expect(mapped.body.message).not.toContain('token');
  });

  it('does not pass internal storage detail through to the client', () => {
    const mapped = mapErrorToResponse(new StorageError('disk failure at /secret/path'));
    expect(mapped.body.message).not.toContain('/secret/path');
  });

  it('handles non-Error throws (strings, objects) safely', () => {
    for (const thrown of ['boom', { weird: true }, null, undefined]) {
      const mapped = mapErrorToResponse(thrown);
      expect(mapped.status).toBe(500);
      expect(mapped.body.error).toBe('INTERNAL_ERROR');
    }
  });
});

describe('registerErrorHandler (Fastify integration)', () => {
  async function buildThrowingApp(error: unknown) {
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    app.get('/boom', () => {
      throw error;
    });
    await app.ready();
    return app;
  }

  it('returns the mapped body when a route throws a taxonomy error', async () => {
    const app = await buildThrowingApp(new SessionExpiredError());
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: 'SESSION_EXPIRED',
      message: 'Your WhatsApp session has expired. Please scan the QR code again.',
    });
    await app.close();
  });

  it('returns a generic 500 with no stack trace for unexpected throws', async () => {
    const app = await buildThrowingApp(new Error('internal stack detail'));
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    const body = res.json<{ error: string; message: string }>();
    expect(body).toEqual({
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    });
    expect(res.body).not.toContain('internal stack detail');
    expect(res.body).not.toContain('at ');
    await app.close();
  });
});

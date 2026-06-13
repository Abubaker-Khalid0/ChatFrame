import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CancelImportResponseSchema,
  ImportProgressSchema,
  StartImportResponseSchema,
} from '@chatframe/shared';

let app: FastifyInstance;
let workspaceDir: string;

beforeEach(async () => {
  workspaceDir = await mkdtemp(join(tmpdir(), 'chatframe-import-routes-'));
  vi.stubEnv('MOCK_MODE', 'true');
  vi.stubEnv('WORKSPACE_DIR', workspaceDir);
  vi.resetModules();

  const { buildApp } = await import('../../app');
  const { resetAdapter } = await import('../../whatsapp/adapterFactory');
  const { resetImportRegistry } = await import('../../import/importRegistry');
  resetAdapter();
  resetImportRegistry();

  app = buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(workspaceDir, { recursive: true, force: true });
});

const startBody = {
  chatId: '905551234567@c.us',
  chatDisplayName: 'Layla',
  options: { includeImages: false },
};

/** Slows the mock stream so an import stays active across requests. */
async function slowFetchSpy(delayMs = 25): Promise<void> {
  const { MockAdapter } = await import('../../whatsapp/MockAdapter');
  const { mockImportMessages } = await import('../../whatsapp/fixtures/mock-import-messages');
  vi.spyOn(MockAdapter.prototype, 'fetchMessages').mockImplementation(async function* (chatId) {
    for (const message of mockImportMessages(chatId)) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      yield message;
    }
  });
}

/** Polls the status endpoint until the import reaches a terminal stage. */
async function waitForTerminal(importId: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const res = await app.inject({ method: 'GET', url: `/api/import/${importId}/status` });
    if (res.statusCode === 200) {
      const progress = ImportProgressSchema.parse(res.json());
      if (['completed', 'failed', 'cancelled'].includes(progress.stage)) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`import ${importId} never reached a terminal stage`);
}

describe('POST /api/import/start (FR-013, FR-017, FR-025)', () => {
  it('returns 202 with a valid StartImportResponse', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/import/start', payload: startBody });

    expect(res.statusCode).toBe(202);
    const body = StartImportResponseSchema.parse(res.json());
    expect(body.stage).toBe('preparing_project');
    expect(body.projectId).toContain('Layla');

    await waitForTerminal(body.importId);
  });

  it('returns 400 with structured issues on an invalid body (FR-025)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/start',
      payload: { chatId: '', options: { includeImages: 'yes' } },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'VALIDATION_ERROR' });
  });

  it('returns 409 IMPORT_IN_PROGRESS while an import is active (FR-017)', async () => {
    await slowFetchSpy();

    const first = await app.inject({
      method: 'POST',
      url: '/api/import/start',
      payload: startBody,
    });
    expect(first.statusCode).toBe(202);
    const { importId } = StartImportResponseSchema.parse(first.json());

    const second = await app.inject({
      method: 'POST',
      url: '/api/import/start',
      payload: startBody,
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: 'IMPORT_IN_PROGRESS' });

    await waitForTerminal(importId);
  });
});

describe('GET /api/import/:importId/status (FR-014)', () => {
  it('returns 200 with the live ImportProgress', async () => {
    await slowFetchSpy();
    const start = await app.inject({
      method: 'POST',
      url: '/api/import/start',
      payload: startBody,
    });
    const { importId, projectId } = StartImportResponseSchema.parse(start.json());

    const res = await app.inject({ method: 'GET', url: `/api/import/${importId}/status` });

    expect(res.statusCode).toBe(200);
    const progress = ImportProgressSchema.parse(res.json());
    expect(progress.importId).toBe(importId);
    expect(progress.projectId).toBe(projectId);

    await waitForTerminal(importId);
  });

  it('returns 404 IMPORT_NOT_FOUND for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/import/imp_unknown/status' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'IMPORT_NOT_FOUND' });
  });
});

describe('POST /api/import/:importId/cancel (FR-015, US4 AC-5)', () => {
  it('registers cancellation during a cancellable stage', async () => {
    await slowFetchSpy();
    const start = await app.inject({
      method: 'POST',
      url: '/api/import/start',
      payload: startBody,
    });
    const { importId } = StartImportResponseSchema.parse(start.json());

    // Wait until the run is inside the fetch stage (cancellable).
    for (let i = 0; i < 100; i += 1) {
      const status = await app.inject({ method: 'GET', url: `/api/import/${importId}/status` });
      const progress = ImportProgressSchema.parse(status.json());
      if (progress.stage === 'fetching_messages') break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const res = await app.inject({ method: 'POST', url: `/api/import/${importId}/cancel` });

    expect(res.statusCode).toBe(200);
    const body = CancelImportResponseSchema.parse(res.json());
    expect(body).toMatchObject({ importId, cancellationRequested: true });

    await waitForTerminal(importId);
    const finalStatus = await app.inject({ method: 'GET', url: `/api/import/${importId}/status` });
    expect(ImportProgressSchema.parse(finalStatus.json()).stage).toBe('cancelled');
  });

  it('gracefully ignores cancellation in a terminal stage', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/import/start',
      payload: startBody,
    });
    const { importId } = StartImportResponseSchema.parse(start.json());
    await waitForTerminal(importId);

    const res = await app.inject({ method: 'POST', url: `/api/import/${importId}/cancel` });

    expect(res.statusCode).toBe(200);
    const body = CancelImportResponseSchema.parse(res.json());
    expect(body.cancellationRequested).toBe(false);
    expect(body.stage).toBe('completed');
  });

  it('returns 404 IMPORT_NOT_FOUND for an unknown id', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/import/imp_unknown/cancel' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'IMPORT_NOT_FOUND' });
  });
});

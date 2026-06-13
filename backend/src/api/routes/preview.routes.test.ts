import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PaginatedPreviewResponseSchema,
  PreviewCountResponseSchema,
  PRIVACY_NAME_PLACEHOLDER,
} from '@chatframe/shared';

let app: FastifyInstance;
let workspace: string | null = null;

/** Builds the app with `MOCK_MODE` and an optional temp workspace stubbed. */
async function buildTestApp(options: { mockMode: boolean }): Promise<void> {
  if (!options.mockMode) {
    workspace = await mkdtemp(join(tmpdir(), 'chatframe-preview-'));
    vi.stubEnv('WORKSPACE_DIR', workspace);
  }
  vi.stubEnv('MOCK_MODE', options.mockMode ? 'true' : 'false');
  vi.resetModules();

  const { buildApp } = await import('../../app');
  app = buildApp();
  await app.ready();
}

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  if (workspace !== null) {
    await rm(workspace, { recursive: true, force: true });
    workspace = null;
  }
});

describe('GET /api/projects/:projectId/preview (contracts C1–C4)', () => {
  it('C1: first page returns <= limit rows ordered ascending with stable totalRows', async () => {
    await buildTestApp({ mockMode: true });

    const first = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview?offset=0&limit=10',
    });
    expect(first.statusCode).toBe(200);
    const page1 = PaginatedPreviewResponseSchema.parse(first.json());

    expect(page1.messages.length).toBeLessThanOrEqual(10);
    expect(page1.messages.length).toBeGreaterThan(0);
    const times = page1.messages.map((m) => m.timestampIso);
    expect(times).toEqual([...times].sort((a, b) => a.localeCompare(b)));
    // Every row carries its dateKey for client-side separators (FR-009).
    expect(page1.messages.every((m) => m.dateKey !== undefined)).toBe(true);

    const second = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview?offset=10&limit=10',
    });
    const page2 = PaginatedPreviewResponseSchema.parse(second.json());
    expect(page2.totalRows).toBe(page1.totalRows);
    expect(page2.messages[0]?.id).not.toBe(page1.messages[0]?.id);
  });

  it('C2: offset past the end yields 200 with an empty messages array', async () => {
    await buildTestApp({ mockMode: true });

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview?offset=100000&limit=100',
    });

    expect(res.statusCode).toBe(200);
    const body = PaginatedPreviewResponseSchema.parse(res.json());
    expect(body.messages).toEqual([]);
    expect(body.totalRows).toBeGreaterThan(0);
  });

  it('C3: invalid query params produce 400 INVALID_QUERY', async () => {
    await buildTestApp({ mockMode: true });

    const tooBig = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview?limit=500',
    });
    expect(tooBig.statusCode).toBe(400);
    expect(tooBig.json()).toMatchObject({ error: 'INVALID_QUERY' });

    const negative = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview?offset=-1',
    });
    expect(negative.statusCode).toBe(400);
    expect(negative.json()).toMatchObject({ error: 'INVALID_QUERY' });

    const nonNumeric = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview?offset=abc',
    });
    expect(nonNumeric.statusCode).toBe(400);
    expect(nonNumeric.json()).toMatchObject({ error: 'INVALID_QUERY' });
  });

  it('C4: privacy is applied to participants and rows, and echoed back', async () => {
    await buildTestApp({ mockMode: true });

    const hidden = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview?showContactName=false',
    });
    const hiddenBody = PaginatedPreviewResponseSchema.parse(hidden.json());

    const contact = hiddenBody.participants.find((p) => !p.isMe);
    expect(contact?.displayName).toBe(PRIVACY_NAME_PLACEHOLDER);
    for (const row of hiddenBody.messages.filter((m) => m.direction === 'received')) {
      expect(row.senderDisplayName).toBe(PRIVACY_NAME_PLACEHOLDER);
    }
    expect(hiddenBody.appliedPrivacy).toMatchObject({ showContactName: false });

    const aliased = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview?displayAlias=Friend',
    });
    const aliasedBody = PaginatedPreviewResponseSchema.parse(aliased.json());
    expect(aliasedBody.participants.find((p) => !p.isMe)?.displayName).toBe('Friend');
    expect(aliasedBody.appliedPrivacy).toMatchObject({ displayAlias: 'Friend' });

    // The local user is never altered (data-model §3).
    expect(aliasedBody.participants.find((p) => p.isMe)?.displayName).toBe('You');
  });
});

describe('GET /api/projects/:projectId/preview — missing data (contract C5)', () => {
  it('returns 404 PROJECT_NOT_FOUND when the project does not exist', async () => {
    await buildTestApp({ mockMode: false });

    const res = await app.inject({ method: 'GET', url: '/api/projects/nope/preview' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'PROJECT_NOT_FOUND' });
  });

  it('returns 404 RENDER_MODEL_NOT_FOUND when no render model exists yet', async () => {
    await buildTestApp({ mockMode: false });
    await mkdir(join(workspace!, 'projects', 'proj-empty'), { recursive: true });

    const res = await app.inject({ method: 'GET', url: '/api/projects/proj-empty/preview' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'RENDER_MODEL_NOT_FOUND' });
  });
});

describe('GET /api/projects/:projectId/preview/count (contract C6)', () => {
  it('totalMessages equals the preview totalRows', async () => {
    await buildTestApp({ mockMode: true });

    const preview = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview',
    });
    const count = await app.inject({
      method: 'GET',
      url: '/api/projects/mock-project/preview/count',
    });

    expect(count.statusCode).toBe(200);
    const countBody = PreviewCountResponseSchema.parse(count.json());
    const previewBody = PaginatedPreviewResponseSchema.parse(preview.json());
    expect(countBody.totalMessages).toBe(previewBody.totalRows);
  });

  it('returns 404 for a missing render model', async () => {
    await buildTestApp({ mockMode: false });
    await mkdir(join(workspace!, 'projects', 'proj-empty'), { recursive: true });

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/proj-empty/preview/count',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'RENDER_MODEL_NOT_FOUND' });
  });
});

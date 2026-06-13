import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportResultSchema, type RenderModel } from '@chatframe/shared';

const PROJECT_ID = 'chatframe_2026-06-10_sara';

let app: FastifyInstance;
let workspace: string | null = null;

/** Builds the app against a temp workspace, mirroring preview.routes.test.ts. */
async function buildTestApp(options: { mockMode: boolean }): Promise<void> {
  workspace = await mkdtemp(join(tmpdir(), 'chatframe-export-route-'));
  vi.stubEnv('WORKSPACE_DIR', workspace);
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

function projectDir(): string {
  if (workspace === null) {
    throw new Error('workspace not initialized');
  }
  return join(workspace, 'projects', PROJECT_ID);
}

async function writeFixtureProject(): Promise<void> {
  const model: RenderModel = {
    projectId: PROJECT_ID,
    chatId: 'chat-1',
    participants: [
      { id: '15550000001@c.us', displayName: 'Me', isMe: true },
      { id: '15551234567@c.us', displayName: 'Sara', isMe: false },
    ],
    entries: [
      { kind: 'date-separator', dateKey: '2026-06-07' },
      {
        kind: 'message',
        id: 'm1',
        senderId: '15551234567@c.us',
        senderDisplayName: 'Sara',
        direction: 'received',
        type: 'text',
        timestampIso: '2026-06-07T08:30:00.000Z',
        dateKey: '2026-06-07',
        body: 'Hello!',
      },
      {
        kind: 'message',
        id: 'm2',
        senderId: '15550000001@c.us',
        direction: 'sent',
        type: 'image',
        timestampIso: '2026-06-07T08:31:00.000Z',
        dateKey: '2026-06-07',
        image: {
          mediaId: 'media-1',
          localPath: 'media/images/img_000001.jpg',
          exportPath: 'assets/media/img_000001.jpg',
        },
      },
    ],
    totalMessages: 2,
  };
  await mkdir(join(projectDir(), 'normalized'), { recursive: true });
  await mkdir(join(projectDir(), 'media', 'images'), { recursive: true });
  await writeFile(
    join(projectDir(), 'normalized', 'render-model.json'),
    JSON.stringify(model, null, 2),
    'utf8',
  );
  await writeFile(join(projectDir(), 'media', 'images', 'img_000001.jpg'), 'fake-jpeg');
}

const VALID_BODY = { settings: {}, locale: 'en' };

function postExport(body: unknown = VALID_BODY) {
  return app.inject({
    method: 'POST',
    url: `/api/projects/${PROJECT_ID}/export/html`,
    payload: body as Record<string, unknown>,
  });
}

// Real archive writes (fonts + assets) flake the 5s default under full-suite
// load; give the whole contract suite a disk-realistic budget (010 polish).
describe('POST /api/projects/:projectId/export/html', { timeout: 30_000 }, () => {
  it('C1: a valid request returns 200 with an ExportResult whose paths exist on disk', async () => {
    await buildTestApp({ mockMode: false });
    await writeFixtureProject();

    const res = await postExport();
    expect(res.statusCode).toBe(200);
    const result = ExportResultSchema.parse(res.json());

    expect(result.projectId).toBe(PROJECT_ID);
    expect(result.imageCount).toBe(1);
    expect(result.totalAssetSize).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    expect((await stat(join(projectDir(), result.htmlFilePath))).isFile()).toBe(true);
    expect((await stat(join(projectDir(), result.exportDir))).isDirectory()).toBe(true);
  });

  it('C9: no render model → 404 RENDER_MODEL_NOT_FOUND', async () => {
    await buildTestApp({ mockMode: false });

    const res = await postExport();
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'RENDER_MODEL_NOT_FOUND' });
  });

  it('C10: a concurrent request is rejected with 409 EXPORT_IN_PROGRESS', async () => {
    await buildTestApp({ mockMode: false });
    await writeFixtureProject();

    // Hold the same lock instance the route uses.
    const registry = await import('../../export/exportRegistry');
    registry.acquireExportLock(PROJECT_ID);
    try {
      const res = await postExport();
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: 'EXPORT_IN_PROGRESS' });
    } finally {
      registry.releaseExportLock(PROJECT_ID);
    }

    // Once released, the export proceeds normally.
    const after = await postExport();
    expect(after.statusCode).toBe(200);
  });

  it('C11: an invalid body (bad theme/locale) → 422 INVALID_REQUEST', async () => {
    await buildTestApp({ mockMode: false });

    const badTheme = await postExport({ settings: { theme: 'sepia' } });
    expect(badTheme.statusCode).toBe(422);
    expect(badTheme.json()).toMatchObject({ error: 'INVALID_REQUEST' });

    const badLocale = await postExport({ settings: {}, locale: 'fr' });
    expect(badLocale.statusCode).toBe(422);
    expect(badLocale.json()).toMatchObject({ error: 'INVALID_REQUEST' });

    const missingSettings = await postExport({});
    expect(missingSettings.statusCode).toBe(422);
  });

  it('C12: re-export overwrites the prior archive and leaves no staging', async () => {
    await buildTestApp({ mockMode: false });
    await writeFixtureProject();

    expect((await postExport()).statusCode).toBe(200);
    await writeFile(join(projectDir(), 'exports', 'html', 'stale.txt'), 'old');

    expect((await postExport()).statusCode).toBe(200);

    expect(await readdir(join(projectDir(), 'exports'))).toEqual(['html']);
    const files = await readdir(join(projectDir(), 'exports', 'html'));
    expect(files).not.toContain('stale.txt');
  });

  it('C6: privacy settings are applied to the exported document (SC-005)', async () => {
    await buildTestApp({ mockMode: false });
    await writeFixtureProject();

    const res = await postExport({
      settings: { showContactName: false, displayAlias: 'Friend', showPhoneNumber: false },
      locale: 'en',
    });
    expect(res.statusCode).toBe(200);

    const html = await readFile(join(projectDir(), 'exports', 'html', 'conversation.html'), 'utf8');
    expect(html).toContain('Friend');
    expect(html).not.toContain('>Sara<');
    expect(html).not.toContain('+15551234567');
  });

  it('serves promoted export files read-only for "Open HTML" (FR-015)', async () => {
    await buildTestApp({ mockMode: false });
    await writeFixtureProject();
    expect((await postExport()).statusCode).toBe(200);

    const html = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/export/files/conversation.html`,
    });
    expect(html.statusCode).toBe(200);
    expect(html.headers['content-type']).toContain('text/html');
    expect(html.body).toContain('cf-chat');

    const css = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/export/files/assets/style.css`,
    });
    expect(css.statusCode).toBe(200);
    expect(css.headers['content-type']).toContain('text/css');

    // Traversal and non-export file types are rejected.
    const traversal = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/export/files/..%2F..%2Fnormalized%2Frender-model.json`,
    });
    expect([400, 404]).toContain(traversal.statusCode);

    const json = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/export/files/render-model.json`,
    });
    expect(json.statusCode).toBe(400);

    const missing = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/export/files/nope.html`,
    });
    expect(missing.statusCode).toBe(404);
  });

  it('logging hygiene (FR-025): export logs carry only non-sensitive metadata', async () => {
    await buildTestApp({ mockMode: false });
    await writeFixtureProject();

    const infoSpy = vi.spyOn(app.log, 'info');
    const errorSpy = vi.spyOn(app.log, 'error');

    const res = await postExport({
      settings: { showContactName: false, displayAlias: 'VerySecretAlias', showPhoneNumber: true },
      locale: 'en',
    });
    expect(res.statusCode).toBe(200);

    const completion = infoSpy.mock.calls.find((call) => call[1] === 'html export completed');
    expect(completion).toBeDefined();
    const payload = completion?.[0] as Record<string, unknown>;

    // Only settings flags, counts, and timing — never content or identities.
    expect(Object.keys(payload).sort()).toEqual(
      [
        'projectId',
        'theme',
        'showContactName',
        'showPhoneNumber',
        'showWatermark',
        'hasAlias',
        'locale',
        'imageCount',
        'totalAssetSize',
        'durationMs',
      ].sort(),
    );
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('VerySecretAlias');
    expect(serialized).not.toContain('Sara');
    expect(serialized).not.toContain('Hello');
    expect(serialized).not.toContain('15551234567');

    // The sanitizer finds nothing to redact — the payload is already clean.
    const { sanitizeForLog } = await import('../../security/sanitizeForLog');
    expect(sanitizeForLog(payload)).toEqual(payload);

    // No error-path logging leaked anything on the success path.
    for (const call of errorSpy.mock.calls) {
      expect(JSON.stringify(call[0] ?? '')).not.toContain('VerySecretAlias');
    }
  });

  it('mock mode: exports the synthetic fixture conversation', async () => {
    await buildTestApp({ mockMode: true });

    const res = await postExport();
    expect(res.statusCode).toBe(200);
    const result = ExportResultSchema.parse(res.json());

    const html = await readFile(join(projectDir(), result.htmlFilePath), 'utf8');
    expect(html).toContain('cf-chat');
    expect(html).not.toContain('<script');
  });
});

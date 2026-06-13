import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let app: FastifyInstance;
let workspace: string;

/** A tiny but real PNG (1×1 transparent pixel) so bytes can be compared. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Seeds a project folder containing one stored image. */
async function seedImage(projectId: string, filename: string): Promise<void> {
  const imagesDir = join(workspace, 'projects', projectId, 'media', 'images');
  await mkdir(imagesDir, { recursive: true });
  await writeFile(join(imagesDir, filename), PNG_BYTES);
}

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'chatframe-media-'));
  vi.stubEnv('WORKSPACE_DIR', workspace);
  vi.resetModules();

  const { buildApp } = await import('../../app');
  app = buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  await rm(workspace, { recursive: true, force: true });
});

describe('GET /api/media/:projectId/:filename (contracts C7–C9)', () => {
  it('C7: streams a valid file with correct content type and bytes', async () => {
    await seedImage('proj-1', 'img_000001.png');

    const res = await app.inject({ method: 'GET', url: '/api/media/proj-1/img_000001.png' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(Number(res.headers['content-length'])).toBe(PNG_BYTES.length);
    expect(res.rawPayload.equals(PNG_BYTES)).toBe(true);
  });

  it('C7: derives jpeg content type from the extension', async () => {
    await seedImage('proj-1', 'img_000002.jpg');

    const res = await app.inject({ method: 'GET', url: '/api/media/proj-1/img_000002.jpg' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
  });

  it('C8: rejects path traversal and non-matching names with 400', async () => {
    await seedImage('proj-1', 'img_000001.png');

    const attempts = [
      '/api/media/proj-1/..%2F..%2Fpackage.json',
      '/api/media/proj-1/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '/api/media/proj-1/not-an-image.png',
      '/api/media/proj-1/img_1.png', // too few digits
      '/api/media/proj-1/img_000001.PNG', // uppercase extension not allowed
    ];

    for (const url of attempts) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(400);
      expect(res.json(), url).toMatchObject({ error: 'INVALID_FILENAME' });
    }
  });

  it('C8: rejects a traversing projectId with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/media/..%2F..%2F/img_000001.png' });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'INVALID_FILENAME' });
  });

  it('C9: returns 404 for an absent file or missing project', async () => {
    await seedImage('proj-1', 'img_000001.png');

    const missingFile = await app.inject({
      method: 'GET',
      url: '/api/media/proj-1/img_999999.png',
    });
    expect(missingFile.statusCode).toBe(404);
    expect(missingFile.json()).toMatchObject({ error: 'MEDIA_NOT_FOUND' });

    const missingProject = await app.inject({
      method: 'GET',
      url: '/api/media/no-such-project/img_000001.png',
    });
    expect(missingProject.statusCode).toBe(404);
    expect(missingProject.json()).toMatchObject({ error: 'MEDIA_NOT_FOUND' });
  });
});

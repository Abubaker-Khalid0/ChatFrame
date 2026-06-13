import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FIXTURE = fileURLToPath(
  new URL('../../normalization/__fixtures__/raw-messages.sample.ndjson', import.meta.url),
);

let app: FastifyInstance;
let workspace: string;
let whenSettled: (projectId: string) => Promise<void>;

/** Creates a project folder under the temp workspace with optional raw data. */
async function seedProject(projectId: string, rawContents: string | null): Promise<string> {
  const projectDir = join(workspace, 'projects', projectId);
  await mkdir(join(projectDir, 'raw'), { recursive: true });
  if (rawContents !== null) {
    await writeFile(join(projectDir, 'raw', 'messages.raw.ndjson'), rawContents, 'utf8');
  }
  return projectDir;
}

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'chatframe-normroute-'));
  vi.stubEnv('WORKSPACE_DIR', workspace);
  vi.resetModules();

  const appModule = await import('../../app');
  const registry = await import('../../normalization/runRegistry');
  registry.resetRegistry();
  whenSettled = registry.whenSettled;

  app = appModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  await rm(workspace, { recursive: true, force: true });
});

describe('normalization routes (contracts/normalization.md)', () => {
  it('runs a normalization and promotes outputs', async () => {
    const fixture = await readFile(FIXTURE, 'utf8');
    const projectDir = await seedProject('proj-ok', fixture);

    const res = await app.inject({ method: 'POST', url: '/api/projects/proj-ok/normalize' });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ projectId: 'proj-ok', state: 'running' });

    await whenSettled('proj-ok');

    const status = await app.inject({
      method: 'GET',
      url: '/api/projects/proj-ok/normalization/status',
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ state: 'completed' });

    const out = await stat(join(projectDir, 'normalized', 'messages.ndjson'));
    expect(out.isFile()).toBe(true);
  });

  it('returns 409 when a run is already in progress', async () => {
    const fixture = await readFile(FIXTURE, 'utf8');
    await seedProject('proj-busy', fixture);

    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/projects/proj-busy/normalize' }),
      app.inject({ method: 'POST', url: '/api/projects/proj-busy/normalize' }),
    ]);

    const codes = [a.statusCode, b.statusCode].sort((x, y) => x - y);
    expect(codes).toEqual([202, 409]);

    const conflict = a.statusCode === 409 ? a : b;
    expect(conflict.json()).toMatchObject({ error: 'NORMALIZATION_IN_PROGRESS' });

    await whenSettled('proj-busy');
  });

  it('returns 422 when raw data is missing or empty', async () => {
    await seedProject('proj-empty', '');

    const res = await app.inject({ method: 'POST', url: '/api/projects/proj-empty/normalize' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: 'NO_RAW_DATA' });
  });

  it('returns 404 for an unknown project', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/projects/missing/normalize' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'PROJECT_NOT_FOUND' });
  });

  it('returns idle status before any run', async () => {
    await seedProject('proj-idle', 'x');
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/proj-idle/normalization/status',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ state: 'idle' });
  });

  it('serves the quality report after a run and 404s before one', async () => {
    const fixture = await readFile(FIXTURE, 'utf8');
    await seedProject('proj-report', fixture);

    const before = await app.inject({
      method: 'GET',
      url: '/api/projects/proj-report/quality-report',
    });
    expect(before.statusCode).toBe(404);
    expect(before.json()).toMatchObject({ error: 'QUALITY_REPORT_NOT_FOUND' });

    await app.inject({ method: 'POST', url: '/api/projects/proj-report/normalize' });
    await whenSettled('proj-report');

    const after = await app.inject({
      method: 'GET',
      url: '/api/projects/proj-report/quality-report',
    });
    expect(after.statusCode).toBe(200);
    expect(after.json()).toMatchObject({
      projectId: 'proj-report',
      totalRawMessages: 13,
      totalNormalizedMessages: 10,
      duplicatesRemoved: 1,
    });
  });

  it('serves the render model after a run and 404s before one', async () => {
    const fixture = await readFile(FIXTURE, 'utf8');
    await seedProject('proj-render', fixture);

    const before = await app.inject({
      method: 'GET',
      url: '/api/projects/proj-render/render-model',
    });
    expect(before.statusCode).toBe(404);
    expect(before.json()).toMatchObject({ error: 'RENDER_MODEL_NOT_FOUND' });

    await app.inject({ method: 'POST', url: '/api/projects/proj-render/normalize' });
    await whenSettled('proj-render');

    const after = await app.inject({
      method: 'GET',
      url: '/api/projects/proj-render/render-model',
    });
    expect(after.statusCode).toBe(200);
    expect(after.json()).toMatchObject({ projectId: 'proj-render', totalMessages: 10 });
  });
});

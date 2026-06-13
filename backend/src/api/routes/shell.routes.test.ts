import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PROJECT_ID = 'chatframe_2026-06-10_sara';

/** Captures spawn invocations; emits 'spawn' so the route resolves. */
const spawnMock = vi.fn(() => {
  const child = new EventEmitter() as EventEmitter & { unref: () => void };
  child.unref = vi.fn();
  queueMicrotask(() => child.emit('spawn'));
  return child;
});

vi.mock('node:child_process', () => ({ spawn: spawnMock }));

let app: FastifyInstance;
let workspace: string | null = null;

async function buildTestApp(): Promise<void> {
  workspace = await mkdtemp(join(tmpdir(), 'chatframe-shell-route-'));
  vi.stubEnv('WORKSPACE_DIR', workspace);
  vi.stubEnv('MOCK_MODE', 'false');
  vi.resetModules();

  const { buildApp } = await import('../../app');
  app = buildApp();
  await app.ready();

  await mkdir(join(workspace, 'projects', PROJECT_ID, 'exports', 'html'), { recursive: true });
}

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  if (workspace !== null) {
    await rm(workspace, { recursive: true, force: true });
    workspace = null;
  }
});

function postOpenFolder(body: unknown) {
  return app.inject({
    method: 'POST',
    url: '/api/shell/open-folder',
    payload: body as Record<string, unknown>,
  });
}

describe('POST /api/shell/open-folder (contracts C13/C14)', () => {
  it('C13: a path inside exports/ → 200 { opened: true } with spawn called via an arg array', async () => {
    await buildTestApp();

    const res = await postOpenFolder({ projectId: PROJECT_ID, path: 'exports/html' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ opened: true });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnMock.mock.calls[0] as unknown as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(typeof command).toBe('string');
    expect(Array.isArray(args)).toBe(true);
    expect(args).toHaveLength(1);
    expect(args[0]).toBe(
      resolve(join(workspace as string, 'projects', PROJECT_ID, 'exports', 'html')),
    );
    // Never a shell string: the option must not opt into a shell.
    expect(options.shell).toBeUndefined();
  });

  it('C13: the exports/ root itself is allowed', async () => {
    await buildTestApp();

    const res = await postOpenFolder({ projectId: PROJECT_ID, path: 'exports' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ opened: true });
  });

  it('C14: a traversal path → 400 PATH_NOT_ALLOWED', async () => {
    await buildTestApp();

    const res = await postOpenFolder({ projectId: PROJECT_ID, path: '../../package.json' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'PATH_NOT_ALLOWED' });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('C14: an absolute path outside the project → 400 PATH_NOT_ALLOWED', async () => {
    await buildTestApp();

    const res = await postOpenFolder({ projectId: PROJECT_ID, path: tmpdir() });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'PATH_NOT_ALLOWED' });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('C14: a non-exports project path → 400 PATH_NOT_ALLOWED', async () => {
    await buildTestApp();

    const res = await postOpenFolder({ projectId: PROJECT_ID, path: 'normalized' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'PATH_NOT_ALLOWED' });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('a traversing projectId → 400 PATH_NOT_ALLOWED', async () => {
    await buildTestApp();

    const res = await postOpenFolder({ projectId: '..', path: 'exports' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'PATH_NOT_ALLOWED' });
  });

  it('an unknown project → 404 PROJECT_NOT_FOUND', async () => {
    await buildTestApp();

    const res = await postOpenFolder({ projectId: 'chatframe_2026-01-01_ghost', path: 'exports' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'PROJECT_NOT_FOUND' });
  });

  it('a malformed body → 400 INVALID_REQUEST', async () => {
    await buildTestApp();

    const res = await postOpenFolder({ projectId: PROJECT_ID });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'INVALID_REQUEST' });
  });

  it('a spawn failure → 500 SHELL_ERROR', async () => {
    await buildTestApp();

    spawnMock.mockImplementationOnce(() => {
      const child = new EventEmitter() as EventEmitter & { unref: () => void };
      child.unref = vi.fn();
      queueMicrotask(() => child.emit('error', new Error('ENOENT')));
      return child;
    });

    const res = await postOpenFolder({ projectId: PROJECT_ID, path: 'exports/html' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'SHELL_ERROR' });
  });
});

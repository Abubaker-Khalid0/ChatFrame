import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedEvent {
  event: string;
  data: Record<string, unknown>;
}

/** Parses SSE wire chunks (`event: x\ndata: json\n\n`) into typed events. */
function parseSse(chunk: string): CapturedEvent[] {
  const events: CapturedEvent[] = [];
  for (const block of chunk.split('\n\n')) {
    const eventMatch = /^event: (.+)$/m.exec(block);
    const dataMatch = /^data: (.+)$/m.exec(block);
    if (eventMatch?.[1] !== undefined && dataMatch?.[1] !== undefined) {
      events.push({
        event: eventMatch[1],
        data: JSON.parse(dataMatch[1]) as Record<string, unknown>,
      });
    }
  }
  return events;
}

let app: FastifyInstance;
let sessionDir: string;
let captured: CapturedEvent[];
let unregister: (() => void) | null = null;

/** Seeds a saved session file under the whatsapp-web-js session path. */
async function seedSession(contents: string): Promise<void> {
  const dir = join(sessionDir, 'whatsapp-web-js');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'session.json'), contents, 'utf8');
}

beforeEach(async () => {
  sessionDir = await mkdtemp(join(tmpdir(), 'chatframe-logout-'));
  vi.stubEnv('MOCK_MODE', 'true');
  vi.stubEnv('SESSION_DIR', sessionDir);
  vi.resetModules();

  const appModule = await import('../../app');
  const { eventManager } = await import('../sse/eventManager');

  captured = [];
  unregister = eventManager.addClient({
    write: (chunk: string) => {
      captured.push(...parseSse(chunk));
    },
  });

  app = appModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  unregister?.();
  unregister = null;
  await app.close();
  vi.unstubAllEnvs();
  await rm(sessionDir, { recursive: true, force: true });
});

describe('POST /api/session/logout (FR-010, FR-014, FR-018)', () => {
  it('logs out a connected session, broadcasts disconnected, and leaves zero session files', async () => {
    await seedSession('valid saved session');

    // Reach `connected` via silent restore on the first status call (FR-008).
    const status = await app.inject({ method: 'GET', url: '/api/session/status' });
    expect(status.json()).toMatchObject({ state: 'connected' });

    const res = await app.inject({ method: 'POST', url: '/api/session/logout' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      state: 'disconnected',
      isRestoring: false,
      connectedAt: null,
      error: null,
    });

    // All tabs converge on `disconnected` over SSE (US3 independent test).
    const states = captured.filter((e) => e.event === 'session.state').map((e) => e.data.state);
    expect(states).toContain('disconnected');

    // Thorough deletion: zero files remain in the session directory (SC-004).
    const { listFilesRecursively } = await import('../../security/sessionProtection');
    expect(await listFilesRecursively(sessionDir)).toHaveLength(0);
  });

  it('logs out from a non-connected state (qr_ready) as well — FR-014 any state', async () => {
    const connect = await app.inject({ method: 'POST', url: '/api/session/connect' });
    expect(connect.json()).toMatchObject({ state: 'qr_ready' });

    const res = await app.inject({ method: 'POST', url: '/api/session/logout' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ state: 'disconnected', connectedAt: null });

    const { listFilesRecursively } = await import('../../security/sessionProtection');
    expect(await listFilesRecursively(sessionDir)).toHaveLength(0);
  });

  it('returns 409 when another session action is in progress (FR-023)', async () => {
    const { tryAcquireSessionLock } = await import('../../whatsapp/sessionLock');
    const release = tryAcquireSessionLock('test-holds-the-lock');
    expect(release).not.toBeNull();

    const res = await app.inject({ method: 'POST', url: '/api/session/logout' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: 'SESSION_ACTION_IN_PROGRESS',
      message: 'A session action is already in progress. Please wait.',
    });

    release?.();
    // After the lock is released the logout succeeds.
    const retry = await app.inject({ method: 'POST', url: '/api/session/logout' });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toMatchObject({ state: 'disconnected' });
  });
});

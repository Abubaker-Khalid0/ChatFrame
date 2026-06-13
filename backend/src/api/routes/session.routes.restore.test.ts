import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedEvent {
  event: string;
  data: Record<string, unknown>;
}

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
  sessionDir = await mkdtemp(join(tmpdir(), 'chatframe-restore-'));
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

describe('auto-restore on GET /api/session/status (FR-008)', () => {
  it('silently restores a saved session to connected with no QR event', async () => {
    await seedSession('valid saved session');

    const res = await app.inject({ method: 'GET', url: '/api/session/status' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      state: 'connected',
      isRestoring: false,
      error: null,
    });
    expect(res.json().connectedAt).toEqual(expect.any(String));

    // No QR was emitted during restore (US2 independent test, SC-003).
    expect(captured.filter((e) => e.event === 'session.qr')).toHaveLength(0);
    const states = captured.filter((e) => e.event === 'session.state').map((e) => e.data.state);
    expect(states).toContain('connected');
  });

  it('transitions an invalid/revoked session to session_expired and cleans it up', async () => {
    await seedSession('corrupt session payload');

    const res = await app.inject({ method: 'GET', url: '/api/session/status' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      state: 'session_expired',
      isRestoring: false,
      error: 'Session expired. Please reconnect.',
    });
    expect(captured.filter((e) => e.event === 'session.qr')).toHaveLength(0);

    // The corrupted session files were removed (edge case in spec.md).
    const { listSessionFiles } = await import('../../whatsapp/sessionStore');
    expect(await listSessionFiles()).toHaveLength(0);
  });

  it('stays disconnected when no saved session exists (FR-006)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/session/status' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ state: 'disconnected', isRestoring: false });
    expect(captured).toHaveLength(0);
  });

  it('attempts restore only once per backend lifetime', async () => {
    await seedSession('valid saved session');

    const first = await app.inject({ method: 'GET', url: '/api/session/status' });
    expect(first.json()).toMatchObject({ state: 'connected' });

    // Log out through the adapter, then ask for status again: no re-restore.
    const { getAdapter } = await import('../../whatsapp/adapterFactory');
    await getAdapter().logout();

    const second = await app.inject({ method: 'GET', url: '/api/session/status' });
    expect(second.json()).toMatchObject({ state: 'disconnected' });
  });
});

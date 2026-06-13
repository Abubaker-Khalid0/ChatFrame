import { mkdtemp, rm } from 'node:fs/promises';
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

function statesOf(events: CapturedEvent[]): string[] {
  return events.filter((e) => e.event === 'session.state').map((e) => String(e.data.state));
}

beforeEach(async () => {
  sessionDir = await mkdtemp(join(tmpdir(), 'chatframe-connect-'));
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
  vi.doUnmock('../../whatsapp/healthCheck');
  await rm(sessionDir, { recursive: true, force: true });
});

describe('POST /api/session/connect (contracts/session-api.md)', () => {
  it('starts the QR flow and broadcasts state + QR events over SSE', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/session/connect' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      state: 'qr_ready',
      isRestoring: false,
      connectedAt: null,
      error: null,
      healthCheck: { available: true, error: null },
    });

    // SSE lifecycle (US1 independent test): initializing → waiting_for_qr →
    // qr_ready, plus one session.qr event with a positive expiresIn.
    expect(statesOf(captured)).toEqual(['initializing', 'waiting_for_qr', 'qr_ready']);
    const qrEvents = captured.filter((e) => e.event === 'session.qr');
    expect(qrEvents).toHaveLength(1);
    expect(qrEvents[0]?.data.qr).toEqual(expect.any(String));
    expect(qrEvents[0]?.data.expiresIn).toBeGreaterThan(0);
  });

  it('returns 409 when another session action is in progress', async () => {
    const { tryAcquireSessionLock } = await import('../../whatsapp/sessionLock');
    const release = tryAcquireSessionLock('test-holds-the-lock');
    expect(release).not.toBeNull();

    const res = await app.inject({ method: 'POST', url: '/api/session/connect' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: 'SESSION_ACTION_IN_PROGRESS',
      message: 'A session action is already in progress. Please wait.',
    });

    release?.();
    // After the lock is released the connect succeeds.
    const retry = await app.inject({ method: 'POST', url: '/api/session/connect' });
    expect(retry.statusCode).toBe(200);
  });

  it('returns 503 when the Chromium health check fails', async () => {
    // Re-build the app with a failing health check (FR-024).
    await app.close();
    unregister?.();
    unregister = null;
    vi.resetModules();
    vi.doMock('../../whatsapp/healthCheck', () => ({
      runHealthCheck: () =>
        Promise.resolve({
          available: false,
          checkedAt: new Date().toISOString(),
          error: 'Failed to launch Chromium: simulated',
        }),
    }));

    const appModule = await import('../../app');
    app = appModule.buildApp();
    await app.ready();

    const res = await app.inject({ method: 'POST', url: '/api/session/connect' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      error: 'CHROMIUM_UNAVAILABLE',
      message: 'WhatsApp integration could not start. Chromium is not available.',
    });

    // The failed health check also surfaces on the status endpoint (SC-012).
    const status = await app.inject({ method: 'GET', url: '/api/session/status' });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      state: 'disconnected',
      healthCheck: { available: false },
    });
  });
});

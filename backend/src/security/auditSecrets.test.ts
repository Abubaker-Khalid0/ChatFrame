import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino from 'pino';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { createWhatsappLogger } from '../config/logger';
import { startImport } from '../import/ImportOrchestrator';
import { resetImportRegistry } from '../import/importRegistry';
import { MockAdapter } from '../whatsapp/MockAdapter';
import { mockImportMessages } from '../whatsapp/fixtures/mock-import-messages';

/**
 * 010 US7 / T051 — log sanitization audit (contracts §2).
 *
 * Two layers are audited:
 * 1. The `whatsapp` Pino log child: `sanitizeForLog` must be registered as a
 *    serializer (T055) so QR payloads, tokens, and secrets are redacted on
 *    every call — including under innocent-looking keys.
 * 2. A full mock import flow: the produced `logs/import.log` and
 *    `logs/normalization.log`, plus every broadcast SSE payload, must contain
 *    zero message content and zero sensitive patterns.
 */

const CHAT_ID = '905551234567@c.us';
const FAKE_QR = '2@AAAaaaBBBbbb0123456789+/=extra,morebase64==,evenmore==';

/** Pino logger writing JSON lines into an in-memory buffer. */
function captureLogger(): { logger: FastifyBaseLogger; lines: () => string } {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString('utf8'));
      callback();
    },
  });
  const logger = pino({ base: null }, sink) as unknown as FastifyBaseLogger;
  return { logger, lines: () => chunks.join('') };
}

describe('whatsapp log child sanitization (T055, contracts §2)', () => {
  it('redacts QR payloads, tokens, and secrets logged through the child', () => {
    const { logger, lines } = captureLogger();
    const child = createWhatsappLogger(logger);

    child.info({ qr: FAKE_QR }, 'qr received');
    child.warn({ details: { authToken: 'tok_super_secret', nested: { qr: FAKE_QR } } }, 'auth');
    child.error({ err: new Error(`launch failed for ${FAKE_QR}`) }, 'init error');
    // A QR-shaped string under an innocent key is still redacted.
    child.info({ payload: { note: FAKE_QR } }, 'sneaky');

    const output = lines();
    expect(output).not.toContain(FAKE_QR);
    expect(output).not.toContain('tok_super_secret');
    expect(output).toContain('[REDACTED]');
  });
});

describe('mock import flow log audit (contracts §2)', () => {
  let projectsDir: string;
  let events: Array<{ name: string; data: unknown }>;

  beforeEach(async () => {
    projectsDir = await mkdtemp(join(tmpdir(), 'chatframe-audit-'));
    events = [];
    resetImportRegistry();
  });

  afterEach(async () => {
    await rm(projectsDir, { recursive: true, force: true });
  });

  it('writes no message content or sensitive patterns to any log or event', async () => {
    const handle = await startImport({
      request: {
        chatId: CHAT_ID,
        chatDisplayName: 'Layla Hassan',
        options: { includeImages: true },
      },
      adapter: new MockAdapter(),
      projectsDir,
      events: {
        broadcast: (name, data) => {
          events.push({ name, data: JSON.parse(JSON.stringify(data)) as unknown });
        },
      },
      adapterName: 'mock',
      retryDelaysMs: [0, 0, 0],
      sleep: () => Promise.resolve(),
    });
    const progress = await handle.done;
    expect(progress.stage).toBe('completed');

    const projectDir = join(projectsDir, handle.projectId);
    const importLog = await readFile(join(projectDir, 'logs', 'import.log'), 'utf8');
    const normalizationLog = await readFile(join(projectDir, 'logs', 'normalization.log'), 'utf8');
    const eventText = JSON.stringify(events);

    // Real message bodies from the raw fixture must never appear anywhere.
    const bodies = mockImportMessages(CHAT_ID)
      .map((message) => message.body)
      .filter((body) => body.length > 0);
    expect(bodies.length).toBeGreaterThan(0);
    for (const corpusName of ['import.log', 'normalization.log', 'sse events'] as const) {
      const corpus =
        corpusName === 'import.log'
          ? importLog
          : corpusName === 'normalization.log'
            ? normalizationLog
            : eventText;
      for (const body of bodies) {
        expect(corpus, `${corpusName} leaked a message body`).not.toContain(body);
      }
      // QR-shaped payloads and obvious secret markers must be absent too.
      expect(corpus, `${corpusName} contains a QR payload`).not.toMatch(/\d@[A-Za-z0-9+/=]{8,}/);
      expect(corpusName + corpus, `${corpusName} mentions tokens/secrets`).not.toMatch(
        /"(token|secret|password|credential)s?"\s*:/i,
      );
    }

    // The contact's display name is never logged (ids and counts only).
    expect(importLog).not.toContain('Layla Hassan');
    expect(normalizationLog).not.toContain('Layla Hassan');
  }, 30_000);
});

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatsResponseSchema } from '@chatframe/shared';

let app: FastifyInstance;

beforeEach(async () => {
  vi.stubEnv('MOCK_MODE', 'true');
  vi.resetModules();

  const { buildApp } = await import('../../app');
  const { resetAdapter } = await import('../../whatsapp/adapterFactory');
  resetAdapter();

  app = buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/chats/private (contracts/chats-api.md)', () => {
  it('returns mapped private chats with non-empty previews (US1)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/chats/private' });

    expect(res.statusCode).toBe(200);
    const { chats } = ChatsResponseSchema.parse(res.json());

    expect(chats.length).toBeGreaterThan(0);
    for (const chat of chats) {
      // Only one-to-one, message-bearing chats cross the boundary (FR-002,
      // FR-021), each with a bounded, non-empty preview (FR-004, FR-018).
      expect(chat.isGroup).toBe(false);
      expect(chat.lastMessagePreview).toBeDefined();
      expect(chat.lastMessagePreview!.length).toBeGreaterThan(0);
      expect(chat.lastMessagePreview!.length).toBeLessThanOrEqual(100);
    }
  });

  it('serves the enriched fixture variety (FR-017)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/chats/private' });
    const { chats } = ChatsResponseSchema.parse(res.json());

    // Media placeholder, phone-only contact, and a no-timestamp chat exist.
    expect(chats.some((c) => c.lastMessagePreview === '📷 Photo')).toBe(true);
    expect(chats.some((c) => c.displayName === null && c.phoneNumber !== null)).toBe(true);
    expect(chats.some((c) => c.lastMessageAt === undefined)).toBe(true);
  });

  it('returns chats sorted by recency, undated last (US5, FR-007)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/chats/private' });
    const { chats } = ChatsResponseSchema.parse(res.json());

    const dated = chats.filter((c) => c.lastMessageAt !== undefined);
    const undated = chats.filter((c) => c.lastMessageAt === undefined);

    // Every undated chat trails every dated one.
    expect(chats.slice(dated.length)).toEqual(undated);
    // Dated chats descend chronologically.
    const datedTimes = dated.map((c) => c.lastMessageAt ?? '');
    expect(datedTimes).toEqual([...datedTimes].sort((a, b) => b.localeCompare(a)));
    expect(undated.length).toBeGreaterThan(0);
  });

  it('returns a structured 409 when the session is not connected (US4, FR-006)', async () => {
    const { MockAdapter } = await import('../../whatsapp/MockAdapter');
    const { WhatsAppNotConnectedError } = await import('../../whatsapp/errors');
    vi.spyOn(MockAdapter.prototype, 'listPrivateChats').mockRejectedValue(
      new WhatsAppNotConnectedError(),
    );

    const res = await app.inject({ method: 'GET', url: '/api/chats/private' });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'SESSION_NOT_CONNECTED' });
  });

  it('returns 500 ADAPTER_ERROR for unexpected adapter failures (FR-015)', async () => {
    const { MockAdapter } = await import('../../whatsapp/MockAdapter');
    vi.spyOn(MockAdapter.prototype, 'listPrivateChats').mockRejectedValue(
      new Error('chromium crashed'),
    );

    const res = await app.inject({ method: 'GET', url: '/api/chats/private' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'ADAPTER_ERROR' });
  });
});

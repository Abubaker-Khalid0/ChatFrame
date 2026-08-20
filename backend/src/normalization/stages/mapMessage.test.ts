import { describe, expect, it } from 'vitest';
import { NormalizedMessageSchema, type RawWhatsAppMessage } from '@chatframe/shared';
import { mapMessage } from './mapMessage';

const NOW_MS = Date.UTC(2026, 5, 10, 12, 0, 0);
const FALLBACK_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const ctx = { fileIndex: 0, fallbackMs: FALLBACK_MS, nowMs: NOW_MS };

function raw(overrides: Partial<RawWhatsAppMessage> = {}): RawWhatsAppMessage {
  return {
    id: 'm1',
    chatId: 'chat-1',
    fromMe: false,
    author: 'contact-1',
    timestamp: Math.trunc(Date.UTC(2026, 5, 7, 9, 0, 0) / 1000),
    type: 'chat',
    body: 'hello',
    hasMedia: false,
    ...overrides,
  };
}

describe('mapMessage (FR-002)', () => {
  it('maps a text message to a schema-valid NormalizedMessage', () => {
    const { mapped } = mapMessage(raw(), ctx);
    expect(() => NormalizedMessageSchema.parse(mapped.message)).not.toThrow();
    expect(mapped.message.type).toBe('text');
    expect(mapped.message.body).toBe('hello');
    expect(mapped.message.isFromMe).toBe(false);
    expect(mapped.message.senderId).toBe('contact-1');
    expect(mapped.rawType).toBe('chat');
  });

  it('maps fromMe to senderId "me"', () => {
    const { mapped } = mapMessage(raw({ fromMe: true, author: 'me' }), ctx);
    expect(mapped.message.isFromMe).toBe(true);
    expect(mapped.message.senderId).toBe('me');
  });

  it('classifies unknown raw types as unsupported (info added later)', () => {
    const { mapped } = mapMessage(raw({ type: 'audio' }), ctx);
    expect(mapped.message.type).toBe('unsupported');
    expect(mapped.rawType).toBe('audio');
  });

  it('maps revoked to deleted with isDeleted true', () => {
    const { mapped } = mapMessage(raw({ type: 'revoked', body: '' }), ctx);
    expect(mapped.message.type).toBe('deleted');
    expect(mapped.message.isDeleted).toBe(true);
    expect(mapped.message.body).toBeUndefined();
  });

  it('falls back to chatId as senderId when author is null on a received message', () => {
    const { mapped } = mapMessage(raw({ author: null }), ctx);
    expect(mapped.message.senderId).toBe('chat-1');
  });

  it('sets senderDisplayName from the resolved contact name on received messages', () => {
    const { mapped } = mapMessage(raw({ senderName: 'Ahmed Ali' }), ctx);
    expect(mapped.message.senderDisplayName).toBe('Ahmed Ali');
  });

  it('threads the resolved sender phone number for received messages', () => {
    const { mapped } = mapMessage(raw({ senderPhoneNumber: '966501234567' }), ctx);
    expect(mapped.senderPhoneNumber).toBe('966501234567');
  });

  it('never attaches the resolved identity to the local user (fromMe)', () => {
    const { mapped } = mapMessage(
      raw({ fromMe: true, author: 'me', senderName: 'Ahmed', senderPhoneNumber: '966501234567' }),
      ctx,
    );
    expect(mapped.message.senderDisplayName).toBeUndefined();
    expect(mapped.senderPhoneNumber).toBeUndefined();
  });
});

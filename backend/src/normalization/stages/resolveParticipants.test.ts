import { describe, expect, it } from 'vitest';
import { ParticipantListSchema, type NormalizedMessage } from '@chatframe/shared';
import { resolveParticipants } from './resolveParticipants';
import type { MappedMessage } from '../types';

function mapped(
  fileIndex: number,
  overrides: Partial<NormalizedMessage> & Pick<NormalizedMessage, 'senderId' | 'isFromMe'>,
): MappedMessage {
  return {
    rawType: 'chat',
    fileIndex,
    message: {
      id: `m${fileIndex}`,
      chatId: 'chat-1',
      type: 'text',
      timestampIso: '2026-06-07T09:00:00.000Z',
      dateKey: '2026-06-07',
      ...overrides,
    },
  };
}

describe('resolveParticipants (FR-011)', () => {
  it('produces one entry per distinct sender', () => {
    const result = resolveParticipants([
      mapped(0, { senderId: 'contact-1', isFromMe: false }),
      mapped(1, { senderId: 'me', isFromMe: true }),
      mapped(2, { senderId: 'contact-1', isFromMe: false }),
    ]);

    expect(() => ParticipantListSchema.parse(result)).not.toThrow();
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['contact-1', 'me']);
  });

  it('derives isMe from isFromMe', () => {
    const result = resolveParticipants([
      mapped(0, { senderId: 'me', isFromMe: true }),
      mapped(1, { senderId: 'contact-1', isFromMe: false }),
    ]);
    expect(result.find((p) => p.id === 'me')?.isMe).toBe(true);
    expect(result.find((p) => p.id === 'contact-1')?.isMe).toBe(false);
  });

  it('keeps the latest non-empty display name for a sender', () => {
    const result = resolveParticipants([
      mapped(0, { senderId: 'contact-1', isFromMe: false, senderDisplayName: 'Ahmed' }),
      mapped(1, { senderId: 'contact-1', isFromMe: false, senderDisplayName: 'Ahmed Ali' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.displayName).toBe('Ahmed Ali');
  });

  it('does not let a later empty name overwrite an earlier real name', () => {
    const result = resolveParticipants([
      mapped(0, { senderId: 'contact-1', isFromMe: false, senderDisplayName: 'Ahmed' }),
      mapped(1, { senderId: 'contact-1', isFromMe: false }),
    ]);
    expect(result[0]?.displayName).toBe('Ahmed');
  });

  it('falls back to the sender id when no display name is present', () => {
    const result = resolveParticipants([mapped(0, { senderId: 'contact-1', isFromMe: false })]);
    expect(result[0]?.displayName).toBe('contact-1');
  });

  it('orders participants by first appearance in the message stream', () => {
    const result = resolveParticipants([
      mapped(0, { senderId: 'me', isFromMe: true }),
      mapped(1, { senderId: 'contact-1', isFromMe: false }),
    ]);
    expect(result.map((p) => p.id)).toEqual(['me', 'contact-1']);
  });

  it('returns an empty list for no messages', () => {
    expect(resolveParticipants([])).toEqual([]);
  });
});

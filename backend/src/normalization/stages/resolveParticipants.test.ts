import { describe, expect, it } from 'vitest';
import {
  ParticipantListSchema,
  PRIVACY_NAME_PLACEHOLDER,
  type NormalizedMessage,
} from '@chatframe/shared';
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

  it('falls back to a bare (non-serialized) sender id when no display name is present', () => {
    const result = resolveParticipants([mapped(0, { senderId: 'contact-1', isFromMe: false })]);
    expect(result[0]?.displayName).toBe('contact-1');
  });

  it('never surfaces a @lid id as the display name and resolves no phone for it', () => {
    const result = resolveParticipants([
      mapped(0, { senderId: '222436708581508@lid', isFromMe: false }),
    ]);
    expect(result[0]?.displayName).toBe(PRIVACY_NAME_PLACEHOLDER);
    expect(result[0]?.id).toBe('222436708581508@lid'); // id stays the stable key
    expect(result[0]?.phoneNumber).toBeUndefined();
  });

  it('hides a missing name but still derives the phone from a phone-based id', () => {
    const result = resolveParticipants([
      mapped(0, { senderId: '15551234567@c.us', isFromMe: false }),
    ]);
    expect(result[0]?.displayName).toBe(PRIVACY_NAME_PLACEHOLDER);
    expect(result[0]?.phoneNumber).toBe('+15551234567');
  });

  it('shows the real name for a @lid contact when the source resolved one', () => {
    const result = resolveParticipants([
      {
        ...mapped(0, {
          senderId: '222436708581508@lid',
          isFromMe: false,
          senderDisplayName: 'Sarah Johnson',
        }),
        senderPhoneNumber: '15551234567',
      },
    ]);
    expect(result[0]?.displayName).toBe('Sarah Johnson');
    expect(result[0]?.phoneNumber).toBe('+15551234567');
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

  it('formats the resolved sender phone number as +<digits> on the participant', () => {
    const result = resolveParticipants([
      {
        ...mapped(0, { senderId: 'contact-1', isFromMe: false, senderDisplayName: 'Ahmed' }),
        senderPhoneNumber: '966501234567',
      },
    ]);
    expect(result[0]?.phoneNumber).toBe('+966501234567');
  });

  it('omits the phone number when the source resolved none (e.g. @lid contact)', () => {
    const result = resolveParticipants([
      mapped(0, { senderId: 'contact-1', isFromMe: false, senderDisplayName: 'Ahmed' }),
    ]);
    expect(result[0]?.phoneNumber).toBeUndefined();
  });

  it('keeps the latest resolved phone number for a sender', () => {
    const result = resolveParticipants([
      {
        ...mapped(0, { senderId: 'contact-1', isFromMe: false }),
        senderPhoneNumber: '966500000000',
      },
      {
        ...mapped(1, { senderId: 'contact-1', isFromMe: false }),
        senderPhoneNumber: '966501234567',
      },
    ]);
    expect(result[0]?.phoneNumber).toBe('+966501234567');
  });
});

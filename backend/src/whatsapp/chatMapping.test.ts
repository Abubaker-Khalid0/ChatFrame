import { describe, expect, it } from 'vitest';
import type { ChatSummary } from '@chatframe/shared';
import {
  isEmptyChat,
  lastMessagePreview,
  resolvePhoneNumber,
  sortByRecency,
  toChatSummary,
  type RawChatInfo,
} from './chatMapping';

describe('lastMessagePreview (FR-004, FR-018)', () => {
  it('returns the trimmed body of a text message', () => {
    expect(lastMessagePreview({ type: 'chat', body: '  hello there  ' })).toBe('hello there');
  });

  it('truncates text to 100 characters', () => {
    const body = 'a'.repeat(150);
    const preview = lastMessagePreview({ type: 'chat', body });
    expect(preview).toHaveLength(100);
    expect(preview).toBe('a'.repeat(100));
  });

  it('keeps a body of exactly 100 characters intact', () => {
    const body = 'b'.repeat(100);
    expect(lastMessagePreview({ type: 'chat', body })).toBe(body);
  });

  it('does not split a surrogate pair at the truncation boundary', () => {
    // 99 chars then an emoji (2 UTF-16 units) straddling the 100 limit.
    const body = 'x'.repeat(99) + '😀' + 'tail';
    const preview = lastMessagePreview({ type: 'chat', body });
    expect(preview.length).toBeLessThanOrEqual(100);
    // The lone high surrogate must not survive.
    expect(preview).toBe('x'.repeat(99));
  });

  it.each([
    ['image', '📷 Photo'],
    ['video', '🎥 Video'],
    ['audio', '🎵 Audio'],
    ['ptt', '🎵 Audio'],
    ['document', '📄 Document'],
    ['sticker', '🏷️ Sticker'],
    ['vcard', '👤 Contact'],
    ['multi_vcard', '👤 Contact'],
    ['location', '📍 Location'],
    ['poll_creation', '📊 Poll'],
  ])('maps a %s last message to "%s"', (type, label) => {
    expect(lastMessagePreview({ type, body: '' })).toBe(label);
  });

  it('falls back to the attachment label for unknown types (FR-018)', () => {
    expect(lastMessagePreview({ type: 'ciphertext', body: '' })).toBe('📎 Attachment');
    expect(lastMessagePreview({ type: 'something_new', body: '' })).toBe('📎 Attachment');
  });

  it('falls back to the attachment label for a text message with a blank body', () => {
    // The contract guarantees a non-empty preview for every returned chat.
    expect(lastMessagePreview({ type: 'chat', body: '   ' })).toBe('📎 Attachment');
  });
});

describe('resolvePhoneNumber (research §6)', () => {
  it('formats an all-digit user part as +<digits>', () => {
    expect(resolvePhoneNumber('966501234567')).toBe('+966501234567');
  });

  it('returns null when the user part is missing', () => {
    expect(resolvePhoneNumber(null)).toBeNull();
  });

  it('returns null when the user part is empty or not all digits', () => {
    expect(resolvePhoneNumber('')).toBeNull();
    expect(resolvePhoneNumber('abc123')).toBeNull();
    expect(resolvePhoneNumber('1234-567')).toBeNull();
  });
});

describe('isEmptyChat (FR-021)', () => {
  it('is empty with no last message and no timestamp', () => {
    expect(isEmptyChat({ lastMessage: null, timestamp: null })).toBe(true);
  });

  it('is empty with no last message and a non-positive timestamp', () => {
    expect(isEmptyChat({ lastMessage: null, timestamp: 0 })).toBe(true);
  });

  it('is not empty when a last message exists', () => {
    expect(isEmptyChat({ lastMessage: { type: 'chat', body: 'hi' }, timestamp: null })).toBe(false);
  });

  it('is not empty when a positive timestamp exists', () => {
    expect(isEmptyChat({ lastMessage: null, timestamp: 1_780_000_000 })).toBe(false);
  });
});

describe('toChatSummary', () => {
  const raw: RawChatInfo = {
    id: '966501234567@c.us',
    name: 'أحمد محمد',
    isGroup: false,
    user: '966501234567',
    timestamp: Date.parse('2026-06-09T14:32:00.000Z') / 1000,
    lastMessage: { type: 'chat', body: 'تمام، نلتقي بكرة' },
  };

  it('assembles a full ChatSummary', () => {
    expect(toChatSummary(raw)).toEqual({
      id: '966501234567@c.us',
      displayName: 'أحمد محمد',
      phoneNumber: '+966501234567',
      isGroup: false,
      lastMessagePreview: 'تمام، نلتقي بكرة',
      lastMessageAt: '2026-06-09T14:32:00.000Z',
    });
  });

  it('omits lastMessageAt when the timestamp is missing', () => {
    const summary = toChatSummary({ ...raw, timestamp: null });
    expect(summary).not.toHaveProperty('lastMessageAt');
    expect(summary.lastMessagePreview).toBe('تمام، نلتقي بكرة');
  });

  it('maps a media last message to its placeholder preview', () => {
    const summary = toChatSummary({ ...raw, lastMessage: { type: 'image', body: '' } });
    expect(summary.lastMessagePreview).toBe('📷 Photo');
  });

  it('keeps displayName null for phone-only contacts', () => {
    const summary = toChatSummary({ ...raw, name: null });
    expect(summary.displayName).toBeNull();
    expect(summary.phoneNumber).toBe('+966501234567');
  });

  it('nulls a displayName that is a serialized id, never showing it', () => {
    const summary = toChatSummary({
      ...raw,
      id: '222436708581508@lid',
      name: '222436708581508@lid',
      user: null,
    });
    expect(summary.displayName).toBeNull();
    expect(summary.phoneNumber).toBeNull();
  });

  it('nulls the phone number for groups', () => {
    const summary = toChatSummary({ ...raw, isGroup: true });
    expect(summary.isGroup).toBe(true);
    expect(summary.phoneNumber).toBeNull();
  });
});

describe('sortByRecency (US5, FR-007)', () => {
  const summary = (id: string, lastMessageAt?: string): ChatSummary => ({
    id,
    displayName: id,
    phoneNumber: null,
    isGroup: false,
    lastMessagePreview: 'hi',
    ...(lastMessageAt === undefined ? {} : { lastMessageAt }),
  });

  it('orders chats by lastMessageAt descending', () => {
    const sorted = sortByRecency([
      summary('old', '2026-06-05T09:00:00.000Z'),
      summary('newest', '2026-06-09T14:00:00.000Z'),
      summary('middle', '2026-06-08T10:00:00.000Z'),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['newest', 'middle', 'old']);
  });

  it('places chats without a timestamp after all dated chats', () => {
    const sorted = sortByRecency([
      summary('undated'),
      summary('dated', '2026-06-01T00:00:00.000Z'),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['dated', 'undated']);
  });

  it('is stable for equal keys and does not mutate its input', () => {
    const input = [
      summary('a', '2026-06-09T14:00:00.000Z'),
      summary('b', '2026-06-09T14:00:00.000Z'),
      summary('undated-1'),
      summary('undated-2'),
    ];
    const snapshot = [...input];

    const sorted = sortByRecency(input);

    expect(sorted.map((c) => c.id)).toEqual(['a', 'b', 'undated-1', 'undated-2']);
    expect(input).toEqual(snapshot);
  });
});

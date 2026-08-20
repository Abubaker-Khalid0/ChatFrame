import { describe, expect, it } from 'vitest';
import { isPrivateChatJid, phoneFromJid, toUnixSeconds } from './baileysMapping';

/**
 * Regression coverage for the timestamp normalization that powers the chat
 * picker. The reported bug (`GET /api/chats/private` returning 0 chats on
 * session restore) traced to JSON-serialized `Long` timestamps deserializing
 * as plain `{ low, high, unsigned }` objects with no `toNumber()` method,
 * which then coerced to `NaN` and dropped every chat's activity timestamp.
 */
describe('toUnixSeconds', () => {
  it('returns plain numbers unchanged (floored)', () => {
    expect(toUnixSeconds(1781530250)).toBe(1781530250);
    expect(toUnixSeconds(1781530250.9)).toBe(1781530250);
  });

  it('parses numeric strings (history-sync messageTimestamp shape)', () => {
    expect(toUnixSeconds('1781793562')).toBe(1781793562);
  });

  it('reads live Long instances via toNumber()', () => {
    const long = { low: 1781530250, high: 0, unsigned: true, toNumber: () => 1781530250 };
    expect(toUnixSeconds(long)).toBe(1781530250);
  });

  it('rehydrates JSON-serialized Long objects (the restore regression)', () => {
    // This is exactly what `JSON.parse` yields for a persisted Long — no
    // prototype, so no `toNumber`. Previously coerced to NaN -> undefined.
    expect(toUnixSeconds({ low: 1781530250, high: 0, unsigned: true })).toBe(1781530250);
  });

  it('rehydrates JSON-serialized Long values above the 32-bit boundary', () => {
    // high=1 contributes 2^32; verify the two words recombine correctly.
    const expected = 0x100000000 + 5; // high=1, low=5
    expect(toUnixSeconds({ low: 5, high: 1, unsigned: true })).toBe(expected);
  });

  it('returns undefined for missing or non-positive values', () => {
    expect(toUnixSeconds(undefined)).toBeUndefined();
    expect(toUnixSeconds(null)).toBeUndefined();
    expect(toUnixSeconds(0)).toBeUndefined();
    expect(toUnixSeconds({ low: 0, high: 0, unsigned: false })).toBeUndefined();
  });
});

describe('isPrivateChatJid', () => {
  it('accepts phone-based and LID one-to-one JIDs', () => {
    expect(isPrivateChatJid('971528986794@s.whatsapp.net')).toBe(true);
    expect(isPrivateChatJid('222436708581508@lid')).toBe(true);
  });

  it('rejects groups, broadcasts, newsletters, and empty input', () => {
    expect(isPrivateChatJid('120363357235663572@g.us')).toBe(false);
    expect(isPrivateChatJid('status@broadcast')).toBe(false);
    expect(isPrivateChatJid('123@newsletter')).toBe(false);
    expect(isPrivateChatJid(null)).toBe(false);
    expect(isPrivateChatJid(undefined)).toBe(false);
  });
});

describe('phoneFromJid', () => {
  it('extracts MSISDN digits from phone JIDs and strips device suffixes', () => {
    expect(phoneFromJid('971528986794@s.whatsapp.net')).toBe('971528986794');
    expect(phoneFromJid('971528986794:12@s.whatsapp.net')).toBe('971528986794');
  });

  it('returns null for opaque LID JIDs', () => {
    expect(phoneFromJid('222436708581508@lid')).toBeNull();
  });
});

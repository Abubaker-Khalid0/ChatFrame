import { describe, expect, it } from 'vitest';
import type { NormalizedMessage } from '@chatframe/shared';
import { mockMessages } from './mock-messages';

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
const hasLatin = (s: string) => /[A-Za-z]/.test(s);
const isEmojiOnly = (s: string) => s.trim().length > 0 && !/[A-Za-z\u0600-\u06FF0-9]/.test(s);

const textBodies = mockMessages
  .filter((m) => m.type === 'text' && typeof m.body === 'string')
  .map((m) => m.body as string);

const sorted: NormalizedMessage[] = [...mockMessages].sort((a, b) =>
  a.timestampIso.localeCompare(b.timestampIso),
);

describe('mock conversation fixture (FR-010 scenario coverage)', () => {
  it('contains 50–80 messages (FR-007)', () => {
    expect(mockMessages.length).toBeGreaterThanOrEqual(50);
    expect(mockMessages.length).toBeLessThanOrEqual(80);
  });

  it('includes Arabic text', () => {
    expect(textBodies.some((b) => hasArabic(b) && !hasLatin(b))).toBe(true);
  });

  it('includes English text', () => {
    expect(textBodies.some((b) => hasLatin(b) && !hasArabic(b))).toBe(true);
  });

  it('includes mixed Arabic/English text', () => {
    expect(textBodies.some((b) => hasArabic(b) && hasLatin(b))).toBe(true);
  });

  it('includes an emoji-only message', () => {
    expect(textBodies.some(isEmojiOnly)).toBe(true);
  });

  it('includes outgoing and incoming messages', () => {
    expect(mockMessages.some((m) => m.isFromMe)).toBe(true);
    expect(mockMessages.some((m) => !m.isFromMe)).toBe(true);
  });

  it('includes an image with a caption', () => {
    expect(mockMessages.some((m) => m.type === 'image' && Boolean(m.image?.caption))).toBe(true);
  });

  it('includes a missing image', () => {
    expect(mockMessages.some((m) => m.type === 'image' && m.image?.missing === true)).toBe(true);
  });

  it('includes a reply to a text message', () => {
    expect(
      mockMessages.some((m) => m.replyTo?.resolved === true && m.replyTo.previewType !== 'image'),
    ).toBe(true);
  });

  it('includes a reply to an image message', () => {
    expect(
      mockMessages.some((m) => m.replyTo?.resolved === true && m.replyTo.previewType === 'image'),
    ).toBe(true);
  });

  it('includes an unresolved reply', () => {
    expect(mockMessages.some((m) => m.replyTo?.resolved === false)).toBe(true);
  });

  it('includes a deleted message', () => {
    expect(mockMessages.some((m) => m.type === 'deleted' || m.isDeleted === true)).toBe(true);
  });

  it('includes an edited message', () => {
    expect(mockMessages.some((m) => m.isEdited === true)).toBe(true);
  });

  it('includes an unsupported message type', () => {
    expect(
      mockMessages.some((m) => m.type === 'unsupported' && Boolean(m.unsupported?.originalType)),
    ).toBe(true);
  });

  it('spans multiple dates (date separators)', () => {
    const dates = new Set(mockMessages.map((m) => m.dateKey));
    expect(dates.size).toBeGreaterThanOrEqual(2);
  });

  it('includes a long message of 500+ characters', () => {
    expect(textBodies.some((b) => b.length >= 500)).toBe(true);
  });

  it('includes consecutive messages from the same sender', () => {
    const consecutive = sorted.some((m, i) => i > 0 && sorted[i - 1]?.senderId === m.senderId);
    expect(consecutive).toBe(true);
  });
});

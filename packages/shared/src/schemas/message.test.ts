import { describe, expect, it } from 'vitest';
import { NormalizedMessageSchema } from './message';

const validText = {
  id: 'msg-001',
  chatId: 'chat-001',
  senderId: 'me',
  isFromMe: true,
  type: 'text',
  body: 'Hello',
  timestampIso: '2026-06-07T09:00:00.000Z',
  dateKey: '2026-06-07',
  status: 'read',
};

describe('NormalizedMessageSchema', () => {
  it('accepts a valid text message', () => {
    expect(NormalizedMessageSchema.safeParse(validText).success).toBe(true);
  });

  it('rejects an unknown type value and reports the path', () => {
    const result = NormalizedMessageSchema.safeParse({ ...validText, type: 'video' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'type')).toBe(true);
    }
  });

  it('rejects a malformed dateKey and reports the path', () => {
    const result = NormalizedMessageSchema.safeParse({ ...validText, dateKey: '07-06-2026' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'dateKey')).toBe(true);
    }
  });

  it('rejects a non-ISO timestamp and reports the path', () => {
    const result = NormalizedMessageSchema.safeParse({ ...validText, timestampIso: 'yesterday' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'timestampIso')).toBe(
        true,
      );
    }
  });

  it('reports a nested image path when required image fields are missing', () => {
    const result = NormalizedMessageSchema.safeParse({
      ...validText,
      type: 'image',
      image: { localPath: 'media/x.jpg', exportPath: 'assets/x.jpg' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'image.mediaId')).toBe(
        true,
      );
    }
  });

  it('accepts a message with a resolved reply reference', () => {
    const result = NormalizedMessageSchema.safeParse({
      ...validText,
      replyTo: { messageId: 'msg-000', resolved: true, previewText: 'hi', previewType: 'text' },
    });
    expect(result.success).toBe(true);
  });
});

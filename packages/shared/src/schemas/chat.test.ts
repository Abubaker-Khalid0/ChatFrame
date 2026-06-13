import { describe, expect, it } from 'vitest';
import { ChatSummarySchema, ChatsResponseSchema } from './chat';

const validChat = {
  id: 'chat-001',
  displayName: 'أحمد محمد',
  phoneNumber: '+966501234567',
  isGroup: false,
  lastMessagePreview: 'مرحبا',
  lastMessageAt: '2026-06-09T14:30:00.000Z',
};

describe('ChatSummarySchema', () => {
  it('accepts a valid chat summary', () => {
    expect(ChatSummarySchema.parse(validChat)).toEqual(validChat);
  });

  it('accepts null displayName and phoneNumber', () => {
    const result = ChatSummarySchema.safeParse({
      ...validChat,
      displayName: null,
      phoneNumber: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing required field and reports its path', () => {
    const { id: _omitted, ...withoutId } = validChat;
    const result = ChatSummarySchema.safeParse(withoutId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'id')).toBe(true);
    }
  });

  it('rejects an empty id', () => {
    const result = ChatSummarySchema.safeParse({ ...validChat, id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a wrong-typed isGroup and reports its path', () => {
    const result = ChatSummarySchema.safeParse({ ...validChat, isGroup: 'no' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'isGroup')).toBe(true);
    }
  });

  it('rejects a lastMessagePreview over 100 characters (FR-004)', () => {
    const result = ChatSummarySchema.safeParse({
      ...validChat,
      lastMessagePreview: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a lastMessagePreview of exactly 100 characters (FR-004)', () => {
    const result = ChatSummarySchema.safeParse({
      ...validChat,
      lastMessagePreview: 'x'.repeat(100),
    });
    expect(result.success).toBe(true);
  });
});

describe('ChatsResponseSchema', () => {
  it('accepts an array envelope of chats', () => {
    expect(ChatsResponseSchema.parse({ chats: [validChat] }).chats).toHaveLength(1);
  });

  it('rejects a non-array chats field', () => {
    expect(ChatsResponseSchema.safeParse({ chats: validChat }).success).toBe(false);
  });
});

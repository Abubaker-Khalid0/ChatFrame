import { describe, expect, it } from 'vitest';
import { ChatSummarySchema, NormalizedMessageSchema, QualityReportSchema } from '@chatframe/shared';
import { mockChatList } from './mock-chat-list';
import { mockMessages } from './mock-messages';
import { mockQualityReport } from './mock-quality-report';

describe('mock fixtures pass shared schema validation (FR-011, SC-004)', () => {
  it('validates all 11 message-bearing chat summaries', () => {
    expect(mockChatList).toHaveLength(11);
    for (const chat of mockChatList) {
      const result = ChatSummarySchema.safeParse(chat);
      expect(result.success, `chat ${chat.id}`).toBe(true);
    }
  });

  it('excludes the empty chat from the mapped list (FR-021)', () => {
    expect(mockChatList.some((chat) => chat.id === 'chat-012')).toBe(false);
  });

  it('validates every normalized message', () => {
    for (const message of mockMessages) {
      const result = NormalizedMessageSchema.safeParse(message);
      expect(result.success, `message ${message.id}`).toBe(true);
    }
  });

  it('validates the quality report', () => {
    expect(QualityReportSchema.safeParse(mockQualityReport).success).toBe(true);
  });

  it('has unique message ids', () => {
    const ids = new Set(mockMessages.map((m) => m.id));
    expect(ids.size).toBe(mockMessages.length);
  });

  it('keeps all chats private (no groups)', () => {
    expect(mockChatList.every((c) => c.isGroup === false)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import type { ChatSummary } from '@chatframe/shared';
import { chatFilter } from './chatFilter';

const make = (id: string, displayName: string | null, phoneNumber: string | null): ChatSummary => ({
  id,
  displayName,
  phoneNumber,
  isGroup: false,
  lastMessagePreview: 'hi',
});

const chats: ChatSummary[] = [
  make('1', 'أحمد محمد', '+966501234567'),
  make('2', 'Sarah Johnson', '+14155550142'),
  make('3', 'Omar Khalid', '+971501112233'),
  make('4', null, '+4915123456789'),
  make('5', 'Mia 😀', '+34600112233'),
];

describe('chatFilter (FR-010, FR-011, SC-008)', () => {
  it('matches names case-insensitively', () => {
    expect(chatFilter(chats, 'sarah')).toEqual([chats[1]]);
    expect(chatFilter(chats, 'SARAH')).toEqual([chats[1]]);
  });

  it('matches partial name fragments', () => {
    expect(chatFilter(chats, 'ohn')).toEqual([chats[1]]);
  });

  it('matches phone number substrings', () => {
    expect(chatFilter(chats, '4155')).toEqual([chats[1]]);
    expect(chatFilter(chats, '+4915')).toEqual([chats[3]]);
  });

  it('matches Arabic names (SC-008)', () => {
    expect(chatFilter(chats, 'أحمد')).toEqual([chats[0]]);
  });

  it('matches names containing emoji and special characters', () => {
    expect(chatFilter(chats, '😀')).toEqual([chats[4]]);
    // Regex-special characters are treated literally, not as patterns.
    expect(chatFilter(chats, '(')).toEqual([]);
  });

  it('returns all chats for an empty or whitespace-only term', () => {
    expect(chatFilter(chats, '')).toEqual(chats);
    expect(chatFilter(chats, '   ')).toEqual(chats);
  });

  it('returns an empty list when nothing matches', () => {
    expect(chatFilter(chats, 'zzzz-no-match')).toEqual([]);
  });

  it('does not match a null displayName against text terms', () => {
    expect(chatFilter(chats, 'null')).toEqual([]);
  });
});

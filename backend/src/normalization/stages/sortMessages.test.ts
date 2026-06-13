import { describe, expect, it } from 'vitest';
import { sortMessages } from './sortMessages';
import type { MappedMessage } from '../types';

function item(id: string, iso: string, fileIndex: number): MappedMessage {
  return {
    rawType: 'chat',
    fileIndex,
    message: {
      id,
      chatId: 'chat-1',
      senderId: 'contact-1',
      isFromMe: false,
      type: 'text',
      timestampIso: iso,
      dateKey: iso.slice(0, 10),
    },
  };
}

describe('sortMessages (FR-004)', () => {
  it('sorts ascending by timestampIso', () => {
    const sorted = sortMessages([
      item('b', '2026-06-07T10:00:00.000Z', 0),
      item('a', '2026-06-07T09:00:00.000Z', 1),
      item('c', '2026-06-07T11:00:00.000Z', 2),
    ]);
    expect(sorted.map((s) => s.message.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties by original file index (stable, deterministic)', () => {
    const iso = '2026-06-07T09:00:00.000Z';
    const sorted = sortMessages([item('x', iso, 2), item('y', iso, 0), item('z', iso, 1)]);
    expect(sorted.map((s) => s.message.id)).toEqual(['y', 'z', 'x']);
  });

  it('does not mutate the input array', () => {
    const input = [
      item('b', '2026-06-07T10:00:00.000Z', 0),
      item('a', '2026-06-07T09:00:00.000Z', 1),
    ];
    const copy = [...input];
    sortMessages(input);
    expect(input.map((s) => s.message.id)).toEqual(copy.map((s) => s.message.id));
  });
});

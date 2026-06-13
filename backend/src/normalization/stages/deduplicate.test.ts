import { describe, expect, it } from 'vitest';
import type { NormalizedMessage } from '@chatframe/shared';
import { deduplicate } from './deduplicate';
import { createMetrics, type MappedMessage } from '../types';

function mapped(
  id: string,
  fileIndex: number,
  extra: Partial<NormalizedMessage> = {},
): MappedMessage {
  return {
    rawType: 'chat',
    fileIndex,
    message: {
      id,
      chatId: 'chat-1',
      senderId: 'contact-1',
      isFromMe: false,
      type: 'text',
      timestampIso: '2026-06-07T09:00:00.000Z',
      dateKey: '2026-06-07',
      ...extra,
    },
  };
}

describe('deduplicate (FR-005)', () => {
  it('retains all messages and removes none when there are no duplicates', () => {
    const metrics = createMetrics();
    const result = deduplicate([mapped('a', 0), mapped('b', 1), mapped('c', 2)], metrics);
    expect(result.map((r) => r.message.id)).toEqual(['a', 'b', 'c']);
    expect(metrics.duplicatesRemoved).toBe(0);
  });

  it('removes exactly 50 duplicates from 50 pairs', () => {
    const items: MappedMessage[] = [];
    let fileIndex = 0;
    for (let i = 0; i < 50; i += 1) {
      items.push(mapped(`m${i}`, fileIndex++));
      items.push(mapped(`m${i}`, fileIndex++));
    }
    const metrics = createMetrics();
    const result = deduplicate(items, metrics);
    expect(result).toHaveLength(50);
    expect(metrics.duplicatesRemoved).toBe(50);
  });

  it('keeps the record with more non-null fields', () => {
    const metrics = createMetrics();
    const sparse = mapped('m', 0);
    const complete = mapped('m', 1, { body: 'hello', status: 'read', isEdited: true });
    const result = deduplicate([sparse, complete], metrics);
    expect(result).toHaveLength(1);
    expect(result[0]?.fileIndex).toBe(1);
    expect(result[0]?.message.body).toBe('hello');
  });

  it('prefers the record more complete even when it appears first', () => {
    const metrics = createMetrics();
    const complete = mapped('m', 0, { body: 'hello', status: 'read' });
    const sparse = mapped('m', 1);
    const result = deduplicate([complete, sparse], metrics);
    expect(result[0]?.fileIndex).toBe(0);
  });

  it('breaks ties by preferring the later record in the file', () => {
    const metrics = createMetrics();
    const result = deduplicate([mapped('m', 0), mapped('m', 1)], metrics);
    expect(result).toHaveLength(1);
    expect(result[0]?.fileIndex).toBe(1);
    expect(metrics.duplicatesRemoved).toBe(1);
  });

  it('leaves a single surviving record when all messages are duplicates', () => {
    const metrics = createMetrics();
    const result = deduplicate([mapped('m', 0), mapped('m', 1), mapped('m', 2)], metrics);
    expect(result).toHaveLength(1);
    expect(metrics.duplicatesRemoved).toBe(2);
  });

  it('preserves input order among surviving records', () => {
    const metrics = createMetrics();
    const result = deduplicate(
      [mapped('a', 0), mapped('b', 1), mapped('a', 2), mapped('c', 3)],
      metrics,
    );
    // 'a' winner is fileIndex 2 but stays in its position relative to b/c.
    expect(result.map((r) => r.message.id)).toEqual(['b', 'a', 'c']);
  });
});

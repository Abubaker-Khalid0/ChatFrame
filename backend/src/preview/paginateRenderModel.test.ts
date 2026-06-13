import { describe, expect, it } from 'vitest';
import type { RenderEntry, RenderModel } from '@chatframe/shared';
import { paginateRenderModel } from './paginateRenderModel';

/** Builds a model of `count` messages across days of 10 messages each. */
function modelWith(count: number, options: { withDateKey?: boolean } = {}): RenderModel {
  const entries: RenderEntry[] = [];
  let lastDay = '';

  for (let i = 0; i < count; i += 1) {
    const day = `2026-06-${String(Math.floor(i / 10) + 1).padStart(2, '0')}`;
    if (day !== lastDay) {
      entries.push({ kind: 'date-separator', dateKey: day });
      lastDay = day;
    }
    entries.push({
      kind: 'message',
      id: `m-${i}`,
      senderId: i % 2 === 0 ? 'me' : 'contact-001',
      direction: i % 2 === 0 ? 'sent' : 'received',
      type: 'text',
      timestampIso: `${day}T08:00:${String(i % 60).padStart(2, '0')}.000Z`,
      ...(options.withDateKey ? { dateKey: day } : {}),
      body: `message ${i}`,
    });
  }

  return {
    projectId: 'proj-1',
    chatId: 'chat-001',
    participants: [],
    entries,
    totalMessages: count,
  };
}

describe('paginateRenderModel (008 plan §1, research §2)', () => {
  it('slices exactly [offset, offset+limit) over message rows, skipping separators', () => {
    const { messages, totalRows } = paginateRenderModel(modelWith(35), 10, 10);

    expect(totalRows).toBe(35);
    expect(messages).toHaveLength(10);
    expect(messages[0]?.id).toBe('m-10');
    expect(messages[9]?.id).toBe('m-19');
    expect(messages.every((row) => row.kind === 'message')).toBe(true);
  });

  it('returns an empty slice when offset is past the end (not an error)', () => {
    const { messages, totalRows } = paginateRenderModel(modelWith(5), 100, 50);

    expect(totalRows).toBe(5);
    expect(messages).toEqual([]);
  });

  it('handles an empty model', () => {
    const { messages, totalRows } = paginateRenderModel(modelWith(0), 0, 100);

    expect(totalRows).toBe(0);
    expect(messages).toEqual([]);
  });

  it('returns a partial last page', () => {
    const { messages, totalRows } = paginateRenderModel(modelWith(25), 20, 10);

    expect(totalRows).toBe(25);
    expect(messages).toHaveLength(5);
    expect(messages[4]?.id).toBe('m-24');
  });

  it('enriches rows missing dateKey from the preceding date separator', () => {
    const { messages } = paginateRenderModel(modelWith(25), 0, 25);

    expect(messages[0]?.dateKey).toBe('2026-06-01');
    expect(messages[10]?.dateKey).toBe('2026-06-02');
    expect(messages[24]?.dateKey).toBe('2026-06-03');
  });

  it('preserves an existing dateKey untouched', () => {
    const { messages } = paginateRenderModel(modelWith(5, { withDateKey: true }), 0, 5);

    expect(messages.every((row) => row.dateKey === '2026-06-01')).toBe(true);
  });

  it('falls back to the UTC day of timestampIso when no separator precedes', () => {
    const model = modelWith(1);
    // Strip the separator so the fallback path is exercised.
    model.entries = model.entries.filter((entry) => entry.kind === 'message');

    const { messages } = paginateRenderModel(model, 0, 1);
    expect(messages[0]?.dateKey).toBe('2026-06-01');
  });
});

import { describe, expect, it } from 'vitest';
import type { NormalizedMessage } from '@chatframe/shared';
import { classifyUnsupported } from './classifyUnsupported';
import { createMetrics, type MappedMessage } from '../types';

function mapped(type: NormalizedMessage['type'], rawType: string, fileIndex = 0): MappedMessage {
  return {
    rawType,
    fileIndex,
    message: {
      id: `m${fileIndex}`,
      chatId: 'chat-1',
      senderId: 'contact-1',
      isFromMe: false,
      type,
      timestampIso: '2026-06-07T09:00:00.000Z',
      dateKey: '2026-06-07',
    },
  };
}

describe('classifyUnsupported (FR-009)', () => {
  it('attaches unsupported info and tallies original types', () => {
    const metrics = createMetrics();
    const items = [mapped('unsupported', 'audio', 0), mapped('unsupported', 'sticker', 1)];

    classifyUnsupported(items, metrics);

    expect(items[0]?.message.unsupported).toEqual({
      originalType: 'audio',
      reason: 'Unsupported message type: audio',
    });
    expect(metrics.unsupportedMessageTypes).toEqual({ audio: 1, sticker: 1 });
  });

  it('uses "unknown" when the raw type is empty', () => {
    const metrics = createMetrics();
    const items = [mapped('unsupported', '', 0)];
    classifyUnsupported(items, metrics);
    expect(items[0]?.message.unsupported?.originalType).toBe('unknown');
    expect(metrics.unsupportedMessageTypes).toEqual({ unknown: 1 });
  });

  it('leaves supported types untouched', () => {
    const metrics = createMetrics();
    const items = [mapped('text', 'chat', 0), mapped('image', 'image', 1)];
    classifyUnsupported(items, metrics);
    expect(items[0]?.message.unsupported).toBeUndefined();
    expect(items[1]?.message.unsupported).toBeUndefined();
    expect(metrics.unsupportedMessageTypes).toEqual({});
  });

  it('counts repeated unsupported types', () => {
    const metrics = createMetrics();
    classifyUnsupported(
      [mapped('unsupported', 'audio', 0), mapped('unsupported', 'audio', 1)],
      metrics,
    );
    expect(metrics.unsupportedMessageTypes).toEqual({ audio: 2 });
  });
});

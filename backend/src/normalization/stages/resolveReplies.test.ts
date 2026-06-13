import { describe, expect, it } from 'vitest';
import type { ImageMetadata, NormalizedMessage } from '@chatframe/shared';
import { resolveReplies } from './resolveReplies';
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

describe('resolveReplies (FR-006, FR-007)', () => {
  it('resolves a reply to a present parent with preview text and type', () => {
    const metrics = createMetrics();
    const items = [
      mapped('parent', 0, { body: 'Original message' }),
      mapped('child', 1, { replyTo: { messageId: 'parent', resolved: false } }),
    ];
    resolveReplies(items, metrics);

    const reply = items[1]?.message.replyTo;
    expect(reply?.resolved).toBe(true);
    expect(reply?.previewType).toBe('text');
    expect(reply?.previewText).toBe('Original message');
    expect(metrics.unresolvedReplies).toBe(0);
  });

  it('truncates preview to 100 code points with an ellipsis', () => {
    const metrics = createMetrics();
    const longBody = 'a'.repeat(150);
    const items = [
      mapped('parent', 0, { body: longBody }),
      mapped('child', 1, { replyTo: { messageId: 'parent', resolved: false } }),
    ];
    resolveReplies(items, metrics);

    const preview = items[1]?.message.replyTo?.previewText ?? '';
    expect([...preview]).toHaveLength(101); // 100 code points + ellipsis
    expect(preview.endsWith('…')).toBe(true);
  });

  it('does not split multi-byte code points when truncating', () => {
    const metrics = createMetrics();
    const emojiBody = '😀'.repeat(150);
    const items = [
      mapped('parent', 0, { body: emojiBody }),
      mapped('child', 1, { replyTo: { messageId: 'parent', resolved: false } }),
    ];
    resolveReplies(items, metrics);

    const preview = items[1]?.message.replyTo?.previewText ?? '';
    expect([...preview].slice(0, 100).every((cp) => cp === '😀')).toBe(true);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('uses the image caption when the parent is an image', () => {
    const metrics = createMetrics();
    const image: ImageMetadata = {
      mediaId: 'img-1',
      localPath: 'media/images/img_000001.jpg',
      exportPath: 'assets/media/img_000001.jpg',
      caption: 'Sunset',
    };
    const items = [
      mapped('parent', 0, { type: 'image', image }),
      mapped('child', 1, { replyTo: { messageId: 'parent', resolved: false } }),
    ];
    resolveReplies(items, metrics);

    const reply = items[1]?.message.replyTo;
    expect(reply?.previewType).toBe('image');
    expect(reply?.previewText).toBe('Sunset');
  });

  it('falls back to a placeholder for an image parent without a caption', () => {
    const metrics = createMetrics();
    const items = [
      mapped('parent', 0, { type: 'image' }),
      mapped('child', 1, { replyTo: { messageId: 'parent', resolved: false } }),
    ];
    resolveReplies(items, metrics);
    expect(items[1]?.message.replyTo?.previewText).toBe('[image]');
  });

  it('marks a reply to an absent parent unresolved and counts it', () => {
    const metrics = createMetrics();
    const items = [mapped('child', 0, { replyTo: { messageId: 'missing', resolved: false } })];
    resolveReplies(items, metrics);

    expect(items[0]?.message.replyTo?.resolved).toBe(false);
    expect(items[0]?.message.replyTo?.previewText).toBeUndefined();
    expect(metrics.unresolvedReplies).toBe(1);
  });

  it('only links the immediate parent (no chain walking)', () => {
    const metrics = createMetrics();
    const items = [
      mapped('a', 0, { body: 'A' }),
      mapped('b', 1, { body: 'B', replyTo: { messageId: 'a', resolved: false } }),
      mapped('c', 2, { replyTo: { messageId: 'b', resolved: false } }),
    ];
    resolveReplies(items, metrics);

    // c resolves to b (its direct parent), previewing b's body — not a's.
    expect(items[2]?.message.replyTo?.resolved).toBe(true);
    expect(items[2]?.message.replyTo?.previewText).toBe('B');
  });

  it('ignores messages without a reply reference', () => {
    const metrics = createMetrics();
    const items = [mapped('a', 0, { body: 'hello' })];
    resolveReplies(items, metrics);
    expect(items[0]?.message.replyTo).toBeUndefined();
    expect(metrics.unresolvedReplies).toBe(0);
  });
});

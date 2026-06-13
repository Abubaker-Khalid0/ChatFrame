import { describe, expect, it } from 'vitest';
import {
  NormalizedMessageSchema,
  type MediaAsset,
  type NormalizedMessage,
} from '@chatframe/shared';
import { linkImages } from './linkImages';
import { createMetrics, type MappedMessage } from '../types';

function imageMessage(
  id: string,
  fileIndex: number,
  rawMediaId?: string,
  rawCaption?: string,
): MappedMessage {
  const message: NormalizedMessage = {
    id,
    chatId: 'chat-1',
    senderId: 'contact-1',
    isFromMe: false,
    type: 'image',
    timestampIso: '2026-06-07T09:00:00.000Z',
    dateKey: '2026-06-07',
  };
  return {
    message,
    rawType: 'image',
    fileIndex,
    ...(rawMediaId !== undefined ? { rawMediaId } : {}),
    ...(rawCaption !== undefined ? { rawCaption } : {}),
  };
}

const presentAsset: MediaAsset = {
  mediaId: 'img-1',
  filename: 'img_000001.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  missing: false,
};

describe('linkImages (FR-008, FR-012, FR-019)', () => {
  it('links a present asset with localPath/exportPath and missing:false', () => {
    const metrics = createMetrics();
    const items = [imageMessage('m1', 0, 'img-1')];
    linkImages(items, metrics, [presentAsset]);

    const image = items[0]?.message.image;
    expect(image?.missing).toBe(false);
    expect(image?.localPath).toBe('media/images/img_000001.jpg');
    expect(image?.exportPath).toBe('assets/media/img_000001.jpg');
    expect(image?.mimeType).toBe('image/jpeg');
    expect(image?.sizeBytes).toBe(1024);
    expect(metrics.missingImages).toBe(0);
    expect(() => NormalizedMessageSchema.parse(items[0]?.message)).not.toThrow();
  });

  it('marks a failed-download asset as missing and increments the count', () => {
    const metrics = createMetrics();
    const failed: MediaAsset = { mediaId: 'img-2', filename: 'img_000002.jpg', missing: true };
    const items = [imageMessage('m1', 0, 'img-2')];
    linkImages(items, metrics, [failed]);

    const image = items[0]?.message.image;
    expect(image?.missing).toBe(true);
    expect(image?.localPath).toBe('media/images/img_000002.jpg');
    expect(metrics.missingImages).toBe(1);
    // The message is retained and still schema-valid.
    expect(() => NormalizedMessageSchema.parse(items[0]?.message)).not.toThrow();
  });

  it('treats an untracked mediaId as missing with a placeholder path', () => {
    const metrics = createMetrics();
    const items = [imageMessage('m1', 0, 'img-unknown')];
    linkImages(items, metrics, []);

    const image = items[0]?.message.image;
    expect(image?.missing).toBe(true);
    expect(image?.mediaId).toBe('img-unknown');
    expect(image?.localPath).toBe('media/images/img-unknown');
    expect(metrics.missingImages).toBe(1);
  });

  it('carries the caption onto the linked image', () => {
    const metrics = createMetrics();
    const items = [imageMessage('m1', 0, 'img-1', 'Sunset')];
    linkImages(items, metrics, [presentAsset]);
    expect(items[0]?.message.image?.caption).toBe('Sunset');
  });

  it('links multiple messages that share one media id to the single index entry', () => {
    const metrics = createMetrics();
    const items = [imageMessage('m1', 0, 'img-1'), imageMessage('m2', 1, 'img-1')];
    linkImages(items, metrics, [presentAsset]);

    expect(items[0]?.message.image?.localPath).toBe('media/images/img_000001.jpg');
    expect(items[1]?.message.image?.localPath).toBe('media/images/img_000001.jpg');
    expect(metrics.missingImages).toBe(0);
  });

  it('handles an image message with no media reference as missing', () => {
    const metrics = createMetrics();
    const items = [imageMessage('m1', 0)];
    linkImages(items, metrics, []);

    expect(items[0]?.message.image?.missing).toBe(true);
    expect(items[0]?.message.image?.mediaId).toBe('m1');
    expect(metrics.missingImages).toBe(1);
  });

  it('ignores non-image messages', () => {
    const metrics = createMetrics();
    const text: MappedMessage = {
      message: {
        id: 't1',
        chatId: 'chat-1',
        senderId: 'contact-1',
        isFromMe: false,
        type: 'text',
        timestampIso: '2026-06-07T09:00:00.000Z',
        dateKey: '2026-06-07',
        body: 'hi',
      },
      rawType: 'chat',
      fileIndex: 0,
    };
    linkImages([text], metrics, [presentAsset]);
    expect(text.message.image).toBeUndefined();
    expect(metrics.missingImages).toBe(0);
  });
});

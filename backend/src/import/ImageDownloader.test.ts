import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RawMediaMetadataSchema, type RawWhatsAppMessage } from '@chatframe/shared';
import { MediaStore } from '../storage/MediaStore';
import type { DownloadedMedia } from '../whatsapp/types';
import { MOCK_IMAGE_BYTES } from '../whatsapp/fixtures/mock-import-messages';
import { ImageDownloader, type ImageDownloadWarning } from './ImageDownloader';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-downloader-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function imageMessage(id: string, mediaId: string): RawWhatsAppMessage {
  return {
    id,
    chatId: 'chat-1@c.us',
    fromMe: false,
    author: 'contact-001',
    timestamp: 1_780_000_000,
    type: 'image',
    body: '',
    hasMedia: true,
    mediaId,
  };
}

function media(): DownloadedMedia {
  return { buffer: MOCK_IMAGE_BYTES, mimeType: 'image/png', filename: 'img.png' };
}

const instantSleep = (): Promise<void> => Promise.resolve();

describe('ImageDownloader (FR-006, FR-012, FR-027, FR-028)', () => {
  it('saves bytes via MediaStore and appends raw provenance lines', async () => {
    const adapter = { downloadImage: vi.fn().mockResolvedValue(media()) };
    const mediaStore = new MediaStore(dir);
    const rawMediaPath = join(dir, 'raw', 'media.raw.ndjson');

    const downloader = new ImageDownloader({
      adapter,
      mediaStore,
      rawMediaPath,
      sleep: instantSleep,
    });
    const result = await downloader.run([
      imageMessage('raw-008', 'media-001'),
      imageMessage('raw-010', 'media-002'),
    ]);

    expect(result).toEqual({ downloaded: 2, missing: 0, total: 2, cancelled: false });

    const index = await mediaStore.readIndex();
    expect(index).toHaveLength(2);
    expect(index.every((asset) => asset.missing === false)).toBe(true);

    const saved = await mediaStore.getImage('media-001');
    expect(saved?.equals(MOCK_IMAGE_BYTES)).toBe(true);

    const lines = (await readFile(rawMediaPath, 'utf8')).trim().split('\n');
    const records = lines.map((line) => RawMediaMetadataSchema.parse(JSON.parse(line)));
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.missing)).toEqual([false, false]);
  });

  it('retries a transient failure then succeeds', async () => {
    const adapter = {
      downloadImage: vi
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce(null)
        .mockResolvedValue(media()),
    };
    const downloader = new ImageDownloader({
      adapter,
      mediaStore: new MediaStore(dir),
      rawMediaPath: join(dir, 'raw', 'media.raw.ndjson'),
      sleep: instantSleep,
    });

    const result = await downloader.run([imageMessage('raw-008', 'media-001')]);

    expect(adapter.downloadImage).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ downloaded: 1, missing: 0, total: 1, cancelled: false });
  });

  it('records missing after retry exhaustion, warns, and continues (SC-005)', async () => {
    const adapter = {
      downloadImage: vi.fn().mockImplementation((message: RawWhatsAppMessage) => {
        if (message.mediaId === 'media-fail-001') {
          return Promise.resolve(null);
        }
        return Promise.resolve(media());
      }),
    };
    const mediaStore = new MediaStore(dir);
    const rawMediaPath = join(dir, 'raw', 'media.raw.ndjson');
    const warnings: ImageDownloadWarning[] = [];
    const onImage = vi.fn();

    const downloader = new ImageDownloader({
      adapter,
      mediaStore,
      rawMediaPath,
      sleep: instantSleep,
      onImage,
      onWarning: (warning) => warnings.push(warning),
    });
    const result = await downloader.run([
      imageMessage('raw-008', 'media-001'),
      imageMessage('raw-009', 'media-fail-001'),
      imageMessage('raw-010', 'media-002'),
    ]);

    // The failing image exhausts 1 + 3 attempts; the import keeps going.
    expect(result).toEqual({ downloaded: 2, missing: 1, total: 3, cancelled: false });
    expect(warnings).toEqual([
      expect.objectContaining({ code: 'IMAGE_DOWNLOAD_FAILED', messageId: 'raw-009' }),
    ]);

    const missingAsset = await mediaStore.getAsset('media-fail-001');
    expect(missingAsset?.missing).toBe(true);

    const lines = (await readFile(rawMediaPath, 'utf8')).trim().split('\n');
    const records = lines.map((line) => RawMediaMetadataSchema.parse(JSON.parse(line)));
    expect(records.filter((r) => r.missing)).toHaveLength(1);
    expect(records.find((r) => r.missing)?.sizeBytes).toBe(0);

    // Progress reported once per settled image (FR-029).
    expect(onImage).toHaveBeenCalledTimes(3);
    expect(onImage).toHaveBeenLastCalledWith(2, 3);
  });

  it('caps download concurrency at 5 (FR-028)', async () => {
    let active = 0;
    let peak = 0;
    const adapter = {
      downloadImage: vi.fn().mockImplementation(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return media();
      }),
    };

    const downloader = new ImageDownloader({
      adapter,
      mediaStore: new MediaStore(dir),
      rawMediaPath: join(dir, 'raw', 'media.raw.ndjson'),
      sleep: instantSleep,
    });
    const messages = Array.from({ length: 12 }, (_, i) =>
      imageMessage(`raw-${i}`, `media-${String(i).padStart(3, '0')}`),
    );
    const result = await downloader.run(messages);

    expect(result.downloaded).toBe(12);
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it('assigns unique sequential filenames under parallel saves', async () => {
    const adapter = { downloadImage: vi.fn().mockResolvedValue(media()) };
    const mediaStore = new MediaStore(dir);
    const downloader = new ImageDownloader({
      adapter,
      mediaStore,
      rawMediaPath: join(dir, 'raw', 'media.raw.ndjson'),
      sleep: instantSleep,
    });

    const messages = Array.from({ length: 8 }, (_, i) => imageMessage(`raw-${i}`, `media-${i}`));
    await downloader.run(messages);

    const index = await mediaStore.readIndex();
    const filenames = index.map((asset) => asset.filename);
    expect(new Set(filenames).size).toBe(8);
  });

  it('skips messages without media ids and non-image types', async () => {
    const adapter = { downloadImage: vi.fn() };
    const downloader = new ImageDownloader({
      adapter,
      mediaStore: new MediaStore(dir),
      rawMediaPath: join(dir, 'raw', 'media.raw.ndjson'),
      sleep: instantSleep,
    });

    const noMedia: RawWhatsAppMessage = {
      id: 'raw-011',
      chatId: 'chat-1@c.us',
      fromMe: false,
      author: null,
      type: 'image',
      body: '',
      hasMedia: true,
    };
    const sticker = { ...imageMessage('raw-006', 'media-x'), type: 'sticker' };

    const result = await downloader.run([noMedia, sticker]);
    expect(result.total).toBe(0);
    expect(adapter.downloadImage).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { RawMediaMetadataSchema } from './raw-media';

describe('RawMediaMetadataSchema (007 FR-007; data-model §7)', () => {
  const valid = {
    mediaId: 'media-001',
    messageId: 'raw-008',
    localPath: 'media/images/img_000001.png',
    mimeType: 'image/png',
    sizeBytes: 67,
    missing: false,
  };

  it('accepts a saved-image record', () => {
    expect(RawMediaMetadataSchema.parse(valid)).toEqual(valid);
  });

  it('accepts a missing record with zero size and no optional fields', () => {
    const parsed = RawMediaMetadataSchema.parse({
      mediaId: 'media-fail-001',
      messageId: 'raw-009',
      localPath: 'media/images/img_000002.png',
      sizeBytes: 0,
      missing: true,
    });
    expect(parsed.missing).toBe(true);
    expect(parsed.mimeType).toBeUndefined();
  });

  it('accepts optional positive dimensions', () => {
    expect(RawMediaMetadataSchema.parse({ ...valid, width: 640, height: 480 }).width).toBe(640);
    expect(RawMediaMetadataSchema.safeParse({ ...valid, width: 0 }).success).toBe(false);
  });

  it('rejects empty required identifiers', () => {
    expect(RawMediaMetadataSchema.safeParse({ ...valid, mediaId: '' }).success).toBe(false);
    expect(RawMediaMetadataSchema.safeParse({ ...valid, messageId: '' }).success).toBe(false);
    expect(RawMediaMetadataSchema.safeParse({ ...valid, localPath: '' }).success).toBe(false);
  });

  it('rejects negative sizes and a missing `missing` flag', () => {
    expect(RawMediaMetadataSchema.safeParse({ ...valid, sizeBytes: -1 }).success).toBe(false);
    const { missing: _missing, ...withoutMissing } = valid;
    expect(RawMediaMetadataSchema.safeParse(withoutMissing).success).toBe(false);
  });
});

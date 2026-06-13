import { describe, expect, it } from 'vitest';
import { ExportHtmlRequestSchema, ExportResultSchema, ExportSettingsSchema } from './export';

describe('ExportSettingsSchema', () => {
  it('applies documented defaults when fields are omitted', () => {
    const result = ExportSettingsSchema.parse({});
    expect(result).toEqual({
      showContactName: true,
      showPhoneNumber: false,
      showWatermark: true,
      theme: 'light',
    });
  });

  it('accepts explicit overrides', () => {
    const result = ExportSettingsSchema.parse({
      showContactName: false,
      showPhoneNumber: true,
      displayAlias: 'A. Mohammed',
      showWatermark: false,
      theme: 'dark',
    });
    expect(result.theme).toBe('dark');
    expect(result.displayAlias).toBe('A. Mohammed');
  });

  it('rejects an invalid theme and reports the path', () => {
    const result = ExportSettingsSchema.safeParse({ theme: 'sepia' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'theme')).toBe(true);
    }
  });

  it('rejects a wrong-typed boolean field', () => {
    expect(ExportSettingsSchema.safeParse({ showWatermark: 'yes' }).success).toBe(false);
  });
});

describe('ExportHtmlRequestSchema (009 data-model §1.2)', () => {
  it('round-trips a fully specified request', () => {
    const request = {
      settings: {
        showContactName: false,
        showPhoneNumber: true,
        displayAlias: 'Friend',
        showWatermark: false,
        theme: 'dark',
      },
      locale: 'ar',
    };
    expect(ExportHtmlRequestSchema.parse(request)).toEqual(request);
  });

  it('defaults locale to en and keeps ExportSettings defaults intact', () => {
    const result = ExportHtmlRequestSchema.parse({ settings: {} });
    expect(result.locale).toBe('en');
    expect(result.settings).toEqual({
      showContactName: true,
      showPhoneNumber: false,
      showWatermark: true,
      theme: 'light',
    });
  });

  it('rejects an unsupported locale', () => {
    expect(ExportHtmlRequestSchema.safeParse({ settings: {}, locale: 'fr' }).success).toBe(false);
  });

  it('rejects a missing settings object', () => {
    expect(ExportHtmlRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('ExportResultSchema (009 data-model §1.1)', () => {
  const valid = {
    projectId: 'chatframe_2026-06-10_friend',
    exportDir: 'exports/html',
    htmlFilePath: 'exports/html/conversation.html',
    imageCount: 42,
    totalAssetSize: 5839201,
    durationMs: 1873,
  };

  it('round-trips a valid result', () => {
    expect(ExportResultSchema.parse(valid)).toEqual(valid);
  });

  it('accepts zero counts and sizes', () => {
    expect(
      ExportResultSchema.parse({ ...valid, imageCount: 0, totalAssetSize: 0, durationMs: 0 }),
    ).toMatchObject({ imageCount: 0 });
  });

  it('rejects negative numeric fields', () => {
    expect(ExportResultSchema.safeParse({ ...valid, imageCount: -1 }).success).toBe(false);
    expect(ExportResultSchema.safeParse({ ...valid, totalAssetSize: -1 }).success).toBe(false);
    expect(ExportResultSchema.safeParse({ ...valid, durationMs: -1 }).success).toBe(false);
  });

  it('rejects non-integer numeric fields', () => {
    expect(ExportResultSchema.safeParse({ ...valid, durationMs: 1.5 }).success).toBe(false);
  });

  it('rejects empty path strings', () => {
    expect(ExportResultSchema.safeParse({ ...valid, exportDir: '' }).success).toBe(false);
    expect(ExportResultSchema.safeParse({ ...valid, htmlFilePath: '' }).success).toBe(false);
  });
});

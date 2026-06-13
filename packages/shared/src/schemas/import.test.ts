import { describe, expect, it } from 'vitest';
import {
  CancelImportResponseSchema,
  ImportOptionsSchema,
  SseImportErrorEventSchema,
  SseImportWarningEventSchema,
  StartImportRequestSchema,
  StartImportResponseSchema,
} from './import';

describe('ImportOptionsSchema (data-model §3)', () => {
  it('defaults includeImages to false (FR-018)', () => {
    expect(ImportOptionsSchema.parse({})).toEqual({ includeImages: false });
  });

  it('accepts an explicit includeImages', () => {
    expect(ImportOptionsSchema.parse({ includeImages: true })).toEqual({ includeImages: true });
  });

  it('rejects a non-boolean includeImages', () => {
    expect(ImportOptionsSchema.safeParse({ includeImages: 'yes' }).success).toBe(false);
  });
});

describe('StartImportRequestSchema (FR-013, FR-025)', () => {
  const valid = { chatId: '905551234567@c.us', options: { includeImages: true } };

  it('accepts a minimal valid request and applies option defaults', () => {
    const parsed = StartImportRequestSchema.parse({ chatId: 'abc@c.us', options: {} });
    expect(parsed.options.includeImages).toBe(false);
  });

  it('accepts the optional display name and phone number', () => {
    const parsed = StartImportRequestSchema.parse({
      ...valid,
      chatDisplayName: 'Layla',
      chatPhoneNumber: '+90 555 123 45 67',
    });
    expect(parsed.chatDisplayName).toBe('Layla');
  });

  it('requires chatId', () => {
    expect(StartImportRequestSchema.safeParse({ options: {} }).success).toBe(false);
  });

  it('rejects an empty chatId', () => {
    expect(StartImportRequestSchema.safeParse({ chatId: '', options: {} }).success).toBe(false);
  });

  it('requires options', () => {
    expect(StartImportRequestSchema.safeParse({ chatId: 'abc@c.us' }).success).toBe(false);
  });
});

describe('StartImportResponseSchema', () => {
  it('accepts a valid response', () => {
    const parsed = StartImportResponseSchema.parse({
      importId: 'imp_1749700000000_a1b2c3',
      projectId: 'chatframe_2026-06-12_Layla',
      stage: 'preparing_project',
      startedAt: '2026-06-12T05:19:02.000Z',
    });
    expect(parsed.stage).toBe('preparing_project');
  });

  it('rejects empty identifiers and unknown stages', () => {
    expect(
      StartImportResponseSchema.safeParse({
        importId: '',
        projectId: 'p',
        stage: 'preparing_project',
        startedAt: '2026-06-12T05:19:02.000Z',
      }).success,
    ).toBe(false);
    expect(
      StartImportResponseSchema.safeParse({
        importId: 'imp_1',
        projectId: 'p',
        stage: 'warming_up',
        startedAt: '2026-06-12T05:19:02.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('CancelImportResponseSchema (FR-015)', () => {
  it('accepts both the accepted and ignored shapes (US4 AC-5)', () => {
    expect(
      CancelImportResponseSchema.parse({
        importId: 'imp_1',
        stage: 'cancelled',
        cancellationRequested: true,
      }).cancellationRequested,
    ).toBe(true);
    expect(
      CancelImportResponseSchema.parse({
        importId: 'imp_1',
        stage: 'completed',
        cancellationRequested: false,
      }).cancellationRequested,
    ).toBe(false);
  });

  it('requires cancellationRequested', () => {
    expect(
      CancelImportResponseSchema.safeParse({ importId: 'imp_1', stage: 'cancelled' }).success,
    ).toBe(false);
  });
});

describe('import SSE event schemas (FR-016; data-model §6)', () => {
  it('validates a warning event with an optional messageId', () => {
    const parsed = SseImportWarningEventSchema.parse({
      importId: 'imp_1',
      code: 'IMAGE_DOWNLOAD_FAILED',
      message: 'Image unavailable after 3 retries; marked missing.',
      messageId: 'raw-0091',
    });
    expect(parsed.code).toBe('IMAGE_DOWNLOAD_FAILED');
    expect(
      SseImportWarningEventSchema.safeParse({
        importId: 'imp_1',
        code: 'INVALID_RAW_LINE',
        message: 'Skipped one invalid raw line.',
      }).success,
    ).toBe(true);
  });

  it('rejects warning/error events with empty codes or messages', () => {
    expect(
      SseImportWarningEventSchema.safeParse({ importId: 'imp_1', code: '', message: 'x' }).success,
    ).toBe(false);
    expect(
      SseImportErrorEventSchema.safeParse({ importId: 'imp_1', code: 'STORAGE_ERROR', message: '' })
        .success,
    ).toBe(false);
  });

  it('validates an error event', () => {
    const parsed = SseImportErrorEventSchema.parse({
      importId: 'imp_1',
      code: 'SESSION_DISCONNECTED',
      message: 'The WhatsApp session was lost during import.',
    });
    expect(parsed.code).toBe('SESSION_DISCONNECTED');
  });
});

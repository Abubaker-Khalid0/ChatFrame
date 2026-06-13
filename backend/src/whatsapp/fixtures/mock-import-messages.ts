import type { RawWhatsAppMessage } from '@chatframe/shared';

/**
 * Synthetic raw import stream for the `MockAdapter` (007 FR-024).
 *
 * Covers every normalization path so the whole import flow is testable without
 * a live connection (Constitution XX): plain text, a reply, a deleted message,
 * an edited message, an unsupported type, a duplicate id, image messages
 * (one designated to fail its download), and a media message without a
 * resolvable media id. Timestamps ascend so chronological sorting is stable.
 */

/** Media ids for which `MockAdapter.downloadImage` always fails (FR-024). */
export const FORCED_FAILURE_MEDIA_ID = 'media-fail-001';

/** Chat id that makes `MockAdapter.fetchMessages` throw a fatal error (US5). */
export const MOCK_FATAL_CHAT_ID = 'fatal-import@c.us';

/**
 * A tiny valid 1×1 transparent PNG, kept in-memory so the mock needs no
 * fixture files on disk (research §9).
 */
export const MOCK_IMAGE_BYTES: Buffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Builds the fixture stream for `chatId` (one entry per scenario). */
export function mockImportMessages(chatId: string): RawWhatsAppMessage[] {
  return [
    {
      id: 'raw-001',
      chatId,
      fromMe: false,
      author: 'contact-001',
      timestamp: 1_780_000_000,
      type: 'chat',
      body: 'السلام عليكم! كيف حالك اليوم؟',
      hasMedia: false,
    },
    {
      id: 'raw-002',
      chatId,
      fromMe: true,
      author: 'me',
      timestamp: 1_780_000_120,
      type: 'chat',
      body: 'وعليكم السلام، الحمد لله بخير.',
      hasMedia: false,
    },
    // A reply quoting the first message (resolveReplies path, US3 of 004).
    {
      id: 'raw-003',
      chatId,
      fromMe: false,
      author: 'contact-001',
      timestamp: 1_780_000_240,
      type: 'chat',
      body: 'هل وصلتك الصور؟',
      hasMedia: false,
      quotedMessageId: 'raw-001',
    },
    // A deleted (revoked) message — preserved, never dropped.
    {
      id: 'raw-004',
      chatId,
      fromMe: true,
      author: 'me',
      timestamp: 1_780_000_360,
      type: 'revoked',
      body: '',
      hasMedia: false,
    },
    // An edited message.
    {
      id: 'raw-005',
      chatId,
      fromMe: false,
      author: 'contact-001',
      timestamp: 1_780_000_480,
      type: 'chat',
      body: 'نلتقي غدًا الساعة الخامسة (معدّلة)',
      hasMedia: false,
      isEdited: true,
    },
    // An unsupported type — classified, counted, preserved.
    {
      id: 'raw-006',
      chatId,
      fromMe: false,
      author: 'contact-001',
      timestamp: 1_780_000_600,
      type: 'sticker',
      body: '',
      hasMedia: true,
    },
    // An exact duplicate of raw-002 (deduplicate path).
    {
      id: 'raw-002',
      chatId,
      fromMe: true,
      author: 'me',
      timestamp: 1_780_000_120,
      type: 'chat',
      body: 'وعليكم السلام، الحمد لله بخير.',
      hasMedia: false,
    },
    // A downloadable image with a caption (US2 happy path).
    {
      id: 'raw-008',
      chatId,
      fromMe: false,
      author: 'contact-001',
      timestamp: 1_780_000_720,
      type: 'image',
      body: '',
      hasMedia: true,
      mediaId: 'media-001',
      caption: 'صورة من الرحلة',
    },
    // An image whose download always fails → retries exhaust → missing (US2).
    {
      id: 'raw-009',
      chatId,
      fromMe: true,
      author: 'me',
      timestamp: 1_780_000_840,
      type: 'image',
      body: '',
      hasMedia: true,
      mediaId: FORCED_FAILURE_MEDIA_ID,
    },
    // A second downloadable image, no caption.
    {
      id: 'raw-010',
      chatId,
      fromMe: true,
      author: 'me',
      timestamp: 1_780_000_960,
      type: 'image',
      body: '',
      hasMedia: true,
      mediaId: 'media-002',
    },
    // Media flagged but no media id — undownloadable, linked as missing.
    {
      id: 'raw-011',
      chatId,
      fromMe: false,
      author: 'contact-001',
      timestamp: 1_780_001_080,
      type: 'image',
      body: '',
      hasMedia: true,
    },
    // A trailing text message so the stream does not end on media.
    {
      id: 'raw-012',
      chatId,
      fromMe: false,
      author: 'contact-001',
      timestamp: 1_780_001_200,
      type: 'chat',
      body: 'تمام، شكرًا لك!',
      hasMedia: false,
    },
  ];
}

import type {
  MessageType,
  NormalizedMessage,
  QualityWarning,
  RawWhatsAppMessage,
} from '@chatframe/shared';
import type { MappedMessage } from '../types';
import { normalizeTimestamp } from './normalizeTimestamp';

/**
 * Raw → `NormalizedMessage` mapping (FR-002).
 *
 * Maps a validated raw record onto the normalized shape, deriving normalized
 * timestamps via {@link normalizeTimestamp}. Type classification is finalized by
 * the `classifyUnsupported` stage; here we assign the directly-known type
 * (`text`/`image`/`deleted`) and mark everything else `unsupported`, carrying
 * the original `rawType` forward for that stage. Reply and image linking happen
 * in their own later stages (US3/US7).
 *
 * Robustness (Phase 10 hardening):
 * - Body text is sanitized: NUL characters and other C0 control codes (except
 *   TAB/LF/CR) are stripped — they break JSON serialization and confuse
 *   rendering, while never appearing in legitimate WhatsApp message text.
 * - Excessively long bodies (>100 KB code units) are truncated with a warning.
 *   This prevents a single runaway message from inflating pipeline memory or
 *   causing export file-size issues.
 * - The `senderId` derivation never produces an empty string — a last-resort
 *   synthetic value is assigned with a warning when all source fields are empty.
 */

/** Known raw source type strings mapped to normalized message types. */
export const RAW_TYPE_MAP: Readonly<Record<string, MessageType>> = {
  chat: 'text',
  text: 'text',
  image: 'image',
  revoked: 'deleted',
};

/**
 * Maximum body length in UTF-16 code units (100 KB). Messages longer than this
 * are almost certainly data corruption or injected payloads — real WhatsApp
 * messages are capped at ~65 KB by the platform itself.
 */
const MAX_BODY_CODE_UNITS = 100_000;

/**
 * Regex matching C0 control characters EXCEPT horizontal tab (0x09),
 * line feed (0x0A), and carriage return (0x0D). These characters break
 * rendering and have no semantic meaning in chat text.
 */
// Matching control characters is the explicit purpose of this pattern.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export interface MapMessageContext {
  /** Zero-based position of this record in the raw file (sort tie-break). */
  fileIndex: number;
  /** Synthetic fallback epoch-ms for a missing timestamp (e.g. previous msg). */
  fallbackMs: number;
  /** "Now" epoch-ms for future-timestamp detection. */
  nowMs: number;
}

export interface MapMessageResult {
  mapped: MappedMessage;
  /** Epoch-ms used, so the caller can chain it as the next `fallbackMs`. */
  epochMs: number;
  warnings: QualityWarning[];
}

/**
 * Sanitizes message body text: strips C0 control characters and enforces a
 * maximum length. Returns the cleaned body (or `undefined` for empty/whitespace-
 * only) and any warnings generated during the process.
 */
function sanitizeBody(
  raw: string,
  messageId: string,
): { body: string | undefined; warnings: QualityWarning[] } {
  const warnings: QualityWarning[] = [];

  // Strip control characters that have no business in chat text.
  let cleaned = raw.replace(CONTROL_CHARS_RE, '');

  // Enforce maximum length to prevent memory issues downstream.
  if (cleaned.length > MAX_BODY_CODE_UNITS) {
    cleaned = cleaned.slice(0, MAX_BODY_CODE_UNITS);
    warnings.push({
      code: 'BODY_TRUNCATED',
      message: `Message ${messageId}: body exceeds ${MAX_BODY_CODE_UNITS} characters; truncated.`,
      messageId,
    });
  }

  return { body: cleaned.length > 0 ? cleaned : undefined, warnings };
}

/**
 * Resolves the sender identity from raw fields, guaranteeing a non-empty value.
 * Falls back to a synthetic id only when all source fields are empty (which
 * would indicate adapter data corruption).
 */
function resolveSenderId(
  raw: RawWhatsAppMessage,
  fileIndex: number,
): { senderId: string; warnings: QualityWarning[] } {
  if (raw.fromMe) return { senderId: 'me', warnings: [] };

  const candidate = raw.author ?? raw.chatId;
  if (candidate && candidate.length > 0) {
    return { senderId: candidate, warnings: [] };
  }

  // Last resort: neither author nor chatId yielded a usable sender.
  const synthetic = `unknown-sender-${fileIndex}`;
  return {
    senderId: synthetic,
    warnings: [
      {
        code: 'MISSING_SENDER',
        message: `Message at index ${fileIndex}: could not determine sender; assigned synthetic id.`,
      },
    ],
  };
}

/** Maps one validated raw message into an indexed normalized message. */
export function mapMessage(raw: RawWhatsAppMessage, ctx: MapMessageContext): MapMessageResult {
  const ts = normalizeTimestamp({
    ...(raw.timestamp !== undefined ? { timestamp: raw.timestamp } : {}),
    fallbackMs: ctx.fallbackMs,
    nowMs: ctx.nowMs,
  });

  const mappedType = RAW_TYPE_MAP[raw.type];
  const type: MessageType = mappedType ?? 'unsupported';

  // Sanitize body text (strip control chars, enforce length limit).
  const { body, warnings: bodyWarnings } = sanitizeBody(raw.body, raw.id);

  // Resolve sender with guaranteed non-empty value.
  const { senderId, warnings: senderWarnings } = resolveSenderId(raw, ctx.fileIndex);

  const message: NormalizedMessage = {
    id: raw.id,
    chatId: raw.chatId,
    senderId,
    ...(!raw.fromMe && raw.senderName !== undefined && raw.senderName.length > 0
      ? { senderDisplayName: raw.senderName }
      : {}),
    isFromMe: raw.fromMe,
    type,
    ...(body !== undefined ? { body } : {}),
    ...(ts.timestampOriginal !== undefined ? { timestampOriginal: ts.timestampOriginal } : {}),
    timestampIso: ts.timestampIso,
    dateKey: ts.dateKey,
    ...(raw.isEdited !== undefined ? { isEdited: raw.isEdited } : {}),
    ...(type === 'deleted' ? { isDeleted: true } : {}),
    // Seed an unresolved reply reference from the source quote; the
    // resolveReplies stage links it to the parent and fills the preview (US3).
    ...(raw.quotedMessageId !== undefined
      ? { replyTo: { messageId: raw.quotedMessageId, resolved: false } }
      : {}),
  };

  return {
    mapped: {
      message,
      rawType: raw.type,
      fileIndex: ctx.fileIndex,
      ...(raw.mediaId !== undefined ? { rawMediaId: raw.mediaId } : {}),
      ...(raw.caption !== undefined ? { rawCaption: raw.caption } : {}),
      ...(!raw.fromMe && raw.senderPhoneNumber !== undefined
        ? { senderPhoneNumber: raw.senderPhoneNumber }
        : {}),
    },
    epochMs: ts.epochMs,
    warnings: [...ts.warnings, ...bodyWarnings, ...senderWarnings],
  };
}

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
 */

/** Known raw source type strings mapped to normalized message types. */
export const RAW_TYPE_MAP: Readonly<Record<string, MessageType>> = {
  chat: 'text',
  text: 'text',
  image: 'image',
  revoked: 'deleted',
};

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

/** Maps one validated raw message into an indexed normalized message. */
export function mapMessage(raw: RawWhatsAppMessage, ctx: MapMessageContext): MapMessageResult {
  const ts = normalizeTimestamp({
    ...(raw.timestamp !== undefined ? { timestamp: raw.timestamp } : {}),
    fallbackMs: ctx.fallbackMs,
    nowMs: ctx.nowMs,
  });

  const mappedType = RAW_TYPE_MAP[raw.type];
  const type: MessageType = mappedType ?? 'unsupported';
  const body = raw.body.length > 0 ? raw.body : undefined;

  const message: NormalizedMessage = {
    id: raw.id,
    chatId: raw.chatId,
    senderId: raw.fromMe ? 'me' : (raw.author ?? raw.chatId),
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
    },
    epochMs: ts.epochMs,
    warnings: ts.warnings,
  };
}

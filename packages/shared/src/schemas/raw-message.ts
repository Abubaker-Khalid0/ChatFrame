import { z } from 'zod';

/**
 * `RawWhatsAppMessage` — the project-owned representation of a single raw
 * message as read from `raw/messages.raw.ndjson`, before normalization. It
 * deliberately references no messaging-library type (Constitution IV) and is
 * kept separate from the shared `NormalizedMessage` to preserve the
 * raw/normalized split (Constitution VI).
 *
 * This schema is validated at the raw-read boundary (FR-001, Constitution XIV):
 * a line that fails it is recorded as a quality warning and never silently
 * dropped (Constitution XXIII).
 *
 * The core fields (`id`, `chatId`, `fromMe`, `author`, `timestamp`, `type`,
 * `body`, `hasMedia`) mirror the adapter contract. The trailing optional fields
 * carry the source metadata that later normalization stages need — reply
 * linking (US3) and image linking (US7) — without forcing every adapter to
 * populate them. `timestamp` is optional so a missing source timestamp can be
 * handled with a synthetic value rather than rejecting the record (FR-003).
 */
export const RawWhatsAppMessageSchema = z.object({
  /** Stable source message id (deduplication key). */
  id: z.string().min(1),
  /** Source chat id the message belongs to. */
  chatId: z.string().min(1),
  /** Whether the local user authored the message. */
  fromMe: z.boolean(),
  /** Sender identifier as reported by the source, or `null`. */
  author: z.string().nullable(),
  /**
   * Human-readable sender name resolved from the source contact (saved name or
   * public push name). Lets normalization show the real identity instead of
   * falling back to the opaque sender id (e.g. WhatsApp `@lid` privacy ids).
   */
  senderName: z.string().optional(),
  /**
   * Real sender phone number digits (MSISDN) resolved from the source contact.
   * Distinct from the serialized id's user part, which for `@lid` ids is an
   * opaque Linked ID rather than the actual number.
   */
  senderPhoneNumber: z.string().optional(),
  /** Original source timestamp in Unix **seconds**. Absent → synthetic (FR-003). */
  timestamp: z.number().int().nonnegative().optional(),
  /** Raw, unclassified type string from the source (e.g. `chat`, `image`). */
  type: z.string().min(1),
  /** Raw text body (may be empty). */
  body: z.string(),
  /** Whether the source flagged attached media. */
  hasMedia: z.boolean(),
  /** Parent message id when this message is a reply (consumed by US3). */
  quotedMessageId: z.string().optional(),
  /** Media reference for image messages (consumed by US7). */
  mediaId: z.string().optional(),
  /** Caption attached to a media message (consumed by US7). */
  caption: z.string().optional(),
  /** Whether the source marked the message as edited. */
  isEdited: z.boolean().optional(),
});

export type RawWhatsAppMessage = z.infer<typeof RawWhatsAppMessageSchema>;

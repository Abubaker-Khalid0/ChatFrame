import { z } from 'zod';

/** Message classification (see data-model.md). */
export const MessageTypeSchema = z.enum(['text', 'image', 'deleted', 'unsupported']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

/** Delivery status of a message. */
export const MessageStatusSchema = z.enum(['sent', 'delivered', 'read', 'unknown']);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

/** Metadata about a reply relationship (nested in NormalizedMessage). */
export const ReplyReferenceSchema = z.object({
  messageId: z.string().optional(),
  resolved: z.boolean(),
  previewText: z.string().optional(),
  previewType: z.string().optional(),
});
export type ReplyReference = z.infer<typeof ReplyReferenceSchema>;

/** Metadata and file references for image messages (nested in NormalizedMessage). */
export const ImageMetadataSchema = z.object({
  mediaId: z.string().min(1),
  localPath: z.string().min(1),
  exportPath: z.string().min(1),
  mimeType: z
    .string()
    .regex(/^[a-z]+\/[a-z0-9.+-]+$/i, 'mimeType must be a valid MIME type')
    .optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().nonnegative().optional(),
  caption: z.string().optional(),
  missing: z.boolean().optional(),
});
export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;

/**
 * Metadata for messages of unrecognized types. Preserves the original type so
 * nothing is silently dropped (Constitution XXIII — no silent data loss).
 */
export const UnsupportedInfoSchema = z.object({
  originalType: z.string().min(1),
  reason: z.string().min(1),
});
export type UnsupportedInfo = z.infer<typeof UnsupportedInfoSchema>;

/**
 * A single message after normalization — the primary shape consumed by the
 * preview renderer and export engine (see data-model.md). Messages are ordered
 * by `timestampIso` ascending within a chat.
 */
export const NormalizedMessageSchema = z.object({
  id: z.string().min(1),
  chatId: z.string().min(1),
  senderId: z.string().min(1),
  senderDisplayName: z.string().optional(),
  isFromMe: z.boolean(),
  type: MessageTypeSchema,
  body: z.string().optional(),
  timestampOriginal: z.string().optional(),
  timestampIso: z.string().datetime(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateKey must be in YYYY-MM-DD format'),
  status: MessageStatusSchema.optional(),
  isEdited: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
  replyTo: ReplyReferenceSchema.optional(),
  image: ImageMetadataSchema.optional(),
  unsupported: UnsupportedInfoSchema.optional(),
});
export type NormalizedMessage = z.infer<typeof NormalizedMessageSchema>;

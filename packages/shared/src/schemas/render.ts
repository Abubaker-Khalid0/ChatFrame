import { z } from 'zod';
import {
  ImageMetadataSchema,
  MessageTypeSchema,
  ReplyReferenceSchema,
  UnsupportedInfoSchema,
} from './message';
import { ParticipantSchema } from './participant';

/**
 * Render model contract (see contracts/render-model.md, FR-013). The render
 * model is the final output of the normalization pipeline and the direct input
 * to the conversation preview. The frontend renders it verbatim and performs no
 * parsing, grouping, or resolution logic (FR-016, Constitution VII).
 */

/** A date divider emitted before the first message of each new day. */
export const DateSeparatorSchema = z.object({
  kind: z.literal('date-separator'),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateKey must be in YYYY-MM-DD format'),
});
export type DateSeparator = z.infer<typeof DateSeparatorSchema>;

/** A single rendered message row (one per normalized message). */
export const MessageRowSchema = z.object({
  kind: z.literal('message'),
  id: z.string().min(1),
  senderId: z.string().min(1),
  senderDisplayName: z.string().optional(),
  direction: z.enum(['sent', 'received']),
  type: MessageTypeSchema,
  timestampIso: z.string().datetime(),
  /**
   * Local calendar day of `timestampIso` (same value the builder uses for
   * `date-separator` entries). Optional for back-compat with render models
   * written before pagination; the paginated preview endpoint enriches it so a
   * message slice can drive client-side date separators (008 FR-009).
   */
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateKey must be in YYYY-MM-DD format')
    .optional(),
  body: z.string().optional(),
  replyTo: ReplyReferenceSchema.optional(),
  image: ImageMetadataSchema.optional(),
  unsupported: UnsupportedInfoSchema.optional(),
  isEdited: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});
export type MessageRow = z.infer<typeof MessageRowSchema>;

/** Ordered entry in the render stream: a date separator or a message row. */
export const RenderEntrySchema = z.discriminatedUnion('kind', [
  DateSeparatorSchema,
  MessageRowSchema,
]);
export type RenderEntry = z.infer<typeof RenderEntrySchema>;

/**
 * The full render model for a conversation. `entries` are ordered
 * chronologically with a `date-separator` before each new `dateKey`;
 * `totalMessages` counts only `message` entries.
 */
export const RenderModelSchema = z.object({
  projectId: z.string().min(1),
  chatId: z.string().min(1),
  participants: z.array(ParticipantSchema),
  entries: z.array(RenderEntrySchema),
  totalMessages: z.number().int().nonnegative(),
});
export type RenderModel = z.infer<typeof RenderModelSchema>;

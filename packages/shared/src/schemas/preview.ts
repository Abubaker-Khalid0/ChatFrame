import { z } from 'zod';
import { NormalizedMessageSchema } from './message';
import { MessageRowSchema } from './render';
import { ParticipantSchema } from './participant';
import { PrivacySettingsSchema } from './view-settings';

/**
 * Response envelope for `GET /api/projects/:projectId/preview`
 * (see contracts/preview.md). Owned by @chatframe/shared so the backend and
 * frontend validate the same contract (FR-003, Constitution XIV).
 */
export const PreviewResponseSchema = z.object({
  projectId: z.string().min(1),
  chatId: z.string().min(1),
  contactName: z.string().nullable(),
  messages: z.array(NormalizedMessageSchema),
  totalMessages: z.number().int().nonnegative(),
});

export type PreviewResponse = z.infer<typeof PreviewResponseSchema>;

/**
 * Paginated preview contract (008 data-model §1.2–§1.4,
 * contracts/preview-api.md). The virtualized preview pages over message rows
 * with offset/limit and sizes its scroll area from the count endpoint.
 */

/** Coerces `"true"`/`"false"` query strings to booleans; anything else fails. */
const QueryBooleanSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]);

/**
 * Query params of `GET /api/projects/:projectId/preview`. Values arrive as
 * strings and are coerced; invalid values produce a `400` at the boundary
 * (data-model §1.2).
 */
export const PreviewQuerySchema = z.object({
  /** Index into message rows (not entries). */
  offset: z.coerce.number().int().nonnegative().default(0),
  /** Page size (research §2). */
  limit: z.coerce.number().int().min(1).max(200).default(100),
  showContactName: QueryBooleanSchema.default(true),
  showPhoneNumber: QueryBooleanSchema.default(false),
  displayAlias: z.string().trim().min(1).optional(),
});
export type PreviewQuery = z.infer<typeof PreviewQuerySchema>;

/** Response body of the paginated preview endpoint (data-model §1.3). */
export const PaginatedPreviewResponseSchema = z.object({
  projectId: z.string().min(1),
  chatId: z.string().min(1),
  /** Participants for sender/header display, after privacy is applied. */
  participants: z.array(ParticipantSchema),
  /** The slice `[offset, offset+limit)` of message rows, privacy-applied. */
  messages: z.array(MessageRowSchema),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().min(1),
  /** Total message rows (equals the count endpoint). */
  totalRows: z.number().int().nonnegative(),
  /** The exact privacy settings the backend applied (client parity check). */
  appliedPrivacy: PrivacySettingsSchema,
});
export type PaginatedPreviewResponse = z.infer<typeof PaginatedPreviewResponseSchema>;

/** Response body of `GET /api/projects/:projectId/preview/count` (data-model §1.4). */
export const PreviewCountResponseSchema = z.object({
  projectId: z.string().min(1),
  /** Total message rows — sizes the virtual scroll area (FR-002). */
  totalMessages: z.number().int().nonnegative(),
});
export type PreviewCountResponse = z.infer<typeof PreviewCountResponseSchema>;

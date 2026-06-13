import { z } from 'zod';

/**
 * Compact representation of a single one-to-one conversation, shown in the
 * chat picker list (see data-model.md). `displayName` and `phoneNumber` are
 * required but may be `null` when the source does not provide them.
 */
export const ChatSummarySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  isGroup: z.boolean(),
  lastMessagePreview: z.string().max(100).optional(),
  lastMessageAt: z.string().datetime().optional(),
});

export type ChatSummary = z.infer<typeof ChatSummarySchema>;

/** Response envelope for `GET /api/chats/private` (see contracts/chats.md). */
export const ChatsResponseSchema = z.object({
  chats: z.array(ChatSummarySchema),
});

export type ChatsResponse = z.infer<typeof ChatsResponseSchema>;

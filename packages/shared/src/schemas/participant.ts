import { z } from 'zod';

/**
 * `Participant` — a resolved sender identity, written as an array to
 * `normalized/participants.json` (FR-011). One entry exists per distinct
 * `senderId`; the display name is chosen from the most recent message carrying
 * a non-empty name, falling back to the id (see data-model.md §Participant).
 */
export const ParticipantSchema = z.object({
  /** Stable sender id; equals `NormalizedMessage.senderId`. */
  id: z.string().min(1),
  /** Human-readable name (latest non-empty variant, else the id). */
  displayName: z.string().min(1),
  /** True for the local user (derived from `isFromMe`). */
  isMe: z.boolean(),
});

export type Participant = z.infer<typeof ParticipantSchema>;

/** The on-disk `normalized/participants.json` shape: a flat array (FR-011). */
export const ParticipantListSchema = z.array(ParticipantSchema);
export type ParticipantList = z.infer<typeof ParticipantListSchema>;

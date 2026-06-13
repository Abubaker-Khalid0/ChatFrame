import {
  RenderModelSchema,
  type NormalizedMessage,
  type Participant,
  type RenderEntry,
  type RenderModel,
} from '@chatframe/shared';

/**
 * Render model assembly (FR-013, contracts/render-model.md).
 *
 * Groups the final, sorted normalized messages into an ordered `RenderEntry[]`,
 * inserting a `date-separator` before the first message of each new `dateKey`.
 * Every message — including unsupported and missing-image messages — becomes a
 * `message` entry, so nothing is hidden from the preview (FR-019, Constitution
 * XXIII). The result is validated against the shared schema (Constitution XIV).
 *
 * `participants` are injected (resolved by US6); the builder does not derive
 * them, keeping participant resolution as the single source of truth.
 */

export interface BuildRenderModelOptions {
  projectId: string;
  /** Conversation id; falls back to the first message's chatId. */
  chatId: string;
  /** Resolved participants (may be empty until US6 is wired). */
  participants: Participant[];
}

/** Converts a normalized message into a render `message` entry. */
function toMessageRow(message: NormalizedMessage): RenderEntry {
  return {
    kind: 'message',
    id: message.id,
    senderId: message.senderId,
    ...(message.senderDisplayName !== undefined
      ? { senderDisplayName: message.senderDisplayName }
      : {}),
    direction: message.isFromMe ? 'sent' : 'received',
    type: message.type,
    timestampIso: message.timestampIso,
    ...(message.body !== undefined ? { body: message.body } : {}),
    ...(message.replyTo !== undefined ? { replyTo: message.replyTo } : {}),
    ...(message.image !== undefined ? { image: message.image } : {}),
    ...(message.unsupported !== undefined ? { unsupported: message.unsupported } : {}),
    ...(message.isEdited !== undefined ? { isEdited: message.isEdited } : {}),
    ...(message.isDeleted !== undefined ? { isDeleted: message.isDeleted } : {}),
  };
}

/**
 * Builds and validates the render model from sorted normalized messages.
 * `messages` MUST already be in ascending chronological order (the pipeline
 * sorts before calling this).
 */
export function buildRenderModel(
  messages: NormalizedMessage[],
  options: BuildRenderModelOptions,
): RenderModel {
  const entries: RenderEntry[] = [];
  let lastDateKey: string | null = null;

  for (const message of messages) {
    if (message.dateKey !== lastDateKey) {
      entries.push({ kind: 'date-separator', dateKey: message.dateKey });
      lastDateKey = message.dateKey;
    }
    entries.push(toMessageRow(message));
  }

  const chatId = messages[0]?.chatId ?? options.chatId;

  const model: RenderModel = {
    projectId: options.projectId,
    chatId: chatId.length > 0 ? chatId : options.projectId,
    participants: options.participants,
    entries,
    totalMessages: messages.length,
  };

  return RenderModelSchema.parse(model);
}

import type { Participant } from '@chatframe/shared';
import type { MappedMessage } from '../types';

/**
 * Participant resolution (FR-011, research §6).
 *
 * Produces one {@link Participant} per distinct `senderId` across the final
 * normalized messages. The display name is the most recent non-empty
 * `senderDisplayName` seen for that sender (messages are processed in ascending
 * chronological order, so later overwrites earlier), falling back to the sender
 * id when no name is present. `isMe` is derived from `isFromMe`.
 *
 * Output order is the sender's first appearance in the sorted message stream,
 * which keeps the result deterministic (SC-003).
 */
export function resolveParticipants(items: MappedMessage[]): Participant[] {
  const order: string[] = [];
  const byId = new Map<string, { displayName: string | undefined; isMe: boolean }>();

  for (const { message } of items) {
    let entry = byId.get(message.senderId);
    if (!entry) {
      entry = { displayName: undefined, isMe: message.isFromMe };
      byId.set(message.senderId, entry);
      order.push(message.senderId);
    }
    entry.isMe = message.isFromMe;
    if (message.senderDisplayName !== undefined && message.senderDisplayName.length > 0) {
      entry.displayName = message.senderDisplayName;
    }
  }

  return order.map((id) => {
    const entry = byId.get(id);
    return {
      id,
      displayName: entry?.displayName ?? id,
      isMe: entry?.isMe ?? false,
    };
  });
}

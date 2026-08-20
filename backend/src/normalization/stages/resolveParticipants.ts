import {
  PRIVACY_NAME_PLACEHOLDER,
  isSerializedWhatsAppId,
  phoneFromWhatsAppId,
  type Participant,
} from '@chatframe/shared';
import type { MappedMessage } from '../types';

/**
 * Participant resolution (FR-011, research §6).
 *
 * Produces one {@link Participant} per distinct `senderId` across the final
 * normalized messages. The display name is the most recent non-empty
 * `senderDisplayName` seen for that sender (messages are processed in ascending
 * chronological order, so later overwrites earlier). When no name is present it
 * falls back to a neutral placeholder the preview/export localize — never the
 * raw sender id, so an opaque WhatsApp identifier (e.g. `<digits>@lid`) can
 * never surface as a contact name. The phone number is the most recent resolved
 * `senderPhoneNumber`, or one derived from a phone-based id, formatted
 * `+<digits>`; it is absent for `@lid`-hidden contacts, whose id carries no real
 * number. `isMe` is derived from `isFromMe`.
 *
 * Output order is the sender's first appearance in the sorted message stream,
 * which keeps the result deterministic (SC-003).
 */
export function resolveParticipants(items: MappedMessage[]): Participant[] {
  const order: string[] = [];
  const byId = new Map<
    string,
    { displayName: string | undefined; isMe: boolean; phoneNumber: string | undefined }
  >();

  for (const item of items) {
    const { message } = item;
    let entry = byId.get(message.senderId);
    if (!entry) {
      entry = { displayName: undefined, isMe: message.isFromMe, phoneNumber: undefined };
      byId.set(message.senderId, entry);
      order.push(message.senderId);
    }
    entry.isMe = message.isFromMe;
    if (message.senderDisplayName !== undefined && message.senderDisplayName.length > 0) {
      entry.displayName = message.senderDisplayName;
    }
    if (item.senderPhoneNumber !== undefined && /^\d+$/.test(item.senderPhoneNumber)) {
      entry.phoneNumber = `+${item.senderPhoneNumber}`;
    }
  }

  return order.map((id) => {
    const entry = byId.get(id);
    // Prefer the real resolved number; otherwise derive it from a phone-based
    // id so the participant still carries it (a `@lid` id never yields one).
    const phoneNumber = entry?.phoneNumber ?? phoneFromWhatsAppId(id);
    // Never surface a serialized WhatsApp id as a name; fall back to the
    // neutral placeholder. Bare (non-serialized) ids — mock/test fixtures —
    // keep their previous behavior.
    const displayName =
      entry?.displayName ?? (isSerializedWhatsAppId(id) ? PRIVACY_NAME_PLACEHOLDER : id);
    return {
      id,
      displayName,
      isMe: entry?.isMe ?? false,
      ...(phoneNumber !== undefined ? { phoneNumber } : {}),
    };
  });
}

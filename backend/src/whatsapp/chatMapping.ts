import type { ChatSummary } from '@chatframe/shared';

/**
 * Pure mapping helpers between adapter-shaped chat data and the project-owned
 * `ChatSummary` contract (research §1). Everything here is side-effect free and
 * library-agnostic so both `WhatsappWebJsAdapter` and `MockAdapter` share one
 * tested implementation (Constitution IV, XX).
 */

/** The maximum preview length guaranteed by the contract (FR-004). */
const PREVIEW_MAX_LENGTH = 100;

/** whatsapp-web.js reports plain text messages with type `chat`. */
const TEXT_TYPES = new Set(['chat', 'text']);

/** Type-specific preview labels for non-text last messages (FR-018). */
const MEDIA_LABELS: Record<string, string> = {
  image: '📷 Photo',
  video: '🎥 Video',
  audio: '🎵 Audio',
  ptt: '🎵 Audio',
  document: '📄 Document',
  sticker: '🏷️ Sticker',
  vcard: '👤 Contact',
  multi_vcard: '👤 Contact',
  location: '📍 Location',
  poll_creation: '📊 Poll',
};

/** Fallback for unrecognized message types — never an empty preview (FR-018). */
const ATTACHMENT_LABEL = '📎 Attachment';

/** The last message of a chat, reduced to the fields the preview needs. */
export interface RawLastMessage {
  type: string;
  body: string;
}

/**
 * Adapter-internal chat shape both adapters can produce without leaking any
 * library type (Constitution IV). `timestamp` is Unix seconds, or `null` when
 * the source reports none.
 */
export interface RawChatInfo {
  id: string;
  name: string | null;
  isGroup: boolean;
  /** User part of the chat id (the MSISDN for one-to-one chats), or `null`. */
  user: string | null;
  timestamp: number | null;
  lastMessage: RawLastMessage | null;
}

/**
 * Builds the list preview for a chat's last message (FR-004, FR-018): trimmed
 * text truncated to 100 characters, or a type-specific placeholder for media.
 * Always non-empty — a blank text body falls back to the attachment label so
 * the contract's non-empty guarantee holds.
 */
export function lastMessagePreview(message: RawLastMessage): string {
  if (TEXT_TYPES.has(message.type)) {
    let text = message.body.trim();
    if (text.length > PREVIEW_MAX_LENGTH) {
      text = text.slice(0, PREVIEW_MAX_LENGTH);
      // Never cut a surrogate pair in half at the boundary.
      const lastUnit = text.charCodeAt(text.length - 1);
      if (lastUnit >= 0xd800 && lastUnit <= 0xdbff) {
        text = text.slice(0, -1);
      }
      text = text.trimEnd();
    }
    if (text.length > 0) {
      return text;
    }
  }
  return MEDIA_LABELS[message.type] ?? ATTACHMENT_LABEL;
}

/**
 * Presents the chat id's user part as an international phone number
 * (`+<digits>`) when it is purely numeric, else `null` (research §6).
 */
export function resolvePhoneNumber(user: string | null): string | null {
  if (user !== null && /^\d+$/.test(user)) {
    return `+${user}`;
  }
  return null;
}

/**
 * A chat with no last message and no positive activity timestamp has no
 * history to archive and is excluded from the picker (FR-021, research §2).
 */
export function isEmptyChat(chat: Pick<RawChatInfo, 'lastMessage' | 'timestamp'>): boolean {
  return chat.lastMessage === null && (chat.timestamp === null || chat.timestamp <= 0);
}

/**
 * Returns a new array ordered by `lastMessageAt` descending, with chats that
 * have no timestamp after every dated chat (FR-007). Stable, so equal keys
 * keep their incoming order.
 */
export function sortByRecency(chats: ChatSummary[]): ChatSummary[] {
  return [...chats].sort((a, b) => {
    if (a.lastMessageAt === undefined) {
      return b.lastMessageAt === undefined ? 0 : 1;
    }
    if (b.lastMessageAt === undefined) {
      return -1;
    }
    // ISO 8601 UTC strings compare chronologically as strings.
    return b.lastMessageAt.localeCompare(a.lastMessageAt);
  });
}

/** Assembles the project-owned `ChatSummary` from adapter-shaped chat data. */
export function toChatSummary(raw: RawChatInfo): ChatSummary {
  const summary: ChatSummary = {
    id: raw.id,
    displayName: raw.name ?? null,
    phoneNumber: raw.isGroup ? null : resolvePhoneNumber(raw.user),
    isGroup: raw.isGroup,
  };
  if (raw.timestamp !== null && raw.timestamp > 0) {
    summary.lastMessageAt = new Date(raw.timestamp * 1000).toISOString();
  }
  if (raw.lastMessage !== null) {
    summary.lastMessagePreview = lastMessagePreview(raw.lastMessage);
  }
  return summary;
}

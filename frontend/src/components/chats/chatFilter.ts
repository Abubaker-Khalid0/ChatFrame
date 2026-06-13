import type { ChatSummary } from '@chatframe/shared';

/**
 * Pure, case-insensitive substring filter over a chat's display name and phone
 * number (FR-010, research §11). Arabic terms match Arabic names; an empty or
 * whitespace-only term shows the full list. No regex — terms are literal, so
 * special characters and emoji are safe (SC-008).
 */
export function chatFilter(chats: ChatSummary[], term: string): ChatSummary[] {
  const needle = term.trim().toLowerCase();
  if (needle.length === 0) {
    return chats;
  }
  return chats.filter(
    (chat) =>
      (chat.displayName !== null && chat.displayName.toLowerCase().includes(needle)) ||
      (chat.phoneNumber !== null && chat.phoneNumber.toLowerCase().includes(needle)),
  );
}

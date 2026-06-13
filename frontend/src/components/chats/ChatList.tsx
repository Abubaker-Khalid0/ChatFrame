import type { ChatSummary } from '@chatframe/shared';
import { useTranslations } from '../../i18n';
import { ChatListItem } from './ChatListItem';

/**
 * Scrollable list of private chats (no virtualization — clarified deferral for
 * ≤1,000 chats). Shows a clear empty state when there are no chats rather than
 * a blank layout (FR-014, Edge Cases).
 */
export function ChatList({
  chats,
  onSelect,
  searchActive = false,
  selectedId = null,
}: {
  chats: ChatSummary[];
  onSelect: (chat: ChatSummary) => void;
  /** True while a search term is filtering the list (FR-014). */
  searchActive?: boolean;
  /** Id of the single selected chat, or `null` (FR-012). */
  selectedId?: string | null;
}) {
  const t = useTranslations();

  if (chats.length === 0) {
    // A fruitless search reads differently from having no chats at all.
    return (
      <p className="py-8 text-center text-gray-500">
        {searchActive ? t.chatPicker.searchEmpty : t.chatPicker.empty}
      </p>
    );
  }

  return (
    <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pe-1">
      {chats.map((chat) => (
        <li key={chat.id}>
          <ChatListItem chat={chat} onSelect={onSelect} selected={chat.id === selectedId} />
        </li>
      ))}
    </ul>
  );
}

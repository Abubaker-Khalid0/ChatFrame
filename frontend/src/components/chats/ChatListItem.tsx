import type { ChatSummary } from '@chatframe/shared';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useTranslations } from '../../i18n';
import { formatRelativeTime } from '../../lib/relativeTime';
import { ChatAvatar } from './ChatAvatar';

const LOCALES: Record<string, string> = { en: 'en-US', ar: 'ar' };

/** A single selectable chat row in the chat picker list. */
export function ChatListItem({
  chat,
  onSelect,
  selected = false,
}: {
  chat: ChatSummary;
  onSelect: (chat: ChatSummary) => void;
  /** Highlights the row as the current single selection (FR-012). */
  selected?: boolean;
}) {
  const t = useTranslations();
  const language = useLanguageStore((s) => s.language);
  const name = chat.displayName ?? chat.phoneNumber ?? t.chatPicker.unknownContact;

  const time = chat.lastMessageAt
    ? formatRelativeTime(chat.lastMessageAt, LOCALES[language] ?? language)
    : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(chat)}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-start transition-colors ${
        selected
          ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
          : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
      }`}
    >
      <ChatAvatar displayName={chat.displayName} phoneNumber={chat.phoneNumber} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-900">{name}</span>
        {chat.phoneNumber && (
          <span className="block truncate text-sm text-gray-500" dir="ltr">
            {chat.phoneNumber}
          </span>
        )}
        {chat.lastMessagePreview && (
          <span className="mt-1 block truncate text-sm text-gray-600">
            {chat.lastMessagePreview}
          </span>
        )}
      </span>
      {time && <time className="shrink-0 text-xs text-gray-400">{time}</time>}
    </button>
  );
}

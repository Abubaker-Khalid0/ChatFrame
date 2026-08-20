import type { ChatSummary } from '@chatframe/shared';
import { useLanguageStore } from '../../stores/useLanguageStore';
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
  const language = useLanguageStore((s) => s.language);
  const name = chat.displayName ?? chat.phoneNumber ?? chat.id.split('@')[0] ?? '';

  const time = chat.lastMessageAt
    ? formatRelativeTime(chat.lastMessageAt, LOCALES[language] ?? language)
    : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(chat)}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-[var(--radius-input)] border px-4 py-3 text-start transition-colors ${
        selected
          ? 'border-accent bg-accent-soft ring-1 ring-accent'
          : 'border-line bg-surface hover:border-accent-border hover:bg-accent-soft'
      }`}
    >
      <ChatAvatar displayName={chat.displayName} phoneNumber={chat.phoneNumber} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{name}</span>
        {chat.phoneNumber && (
          <span className="block truncate text-sm text-ink-muted" dir="ltr">
            {chat.phoneNumber}
          </span>
        )}
        {chat.lastMessagePreview && (
          <span className="mt-1 block truncate text-sm text-ink-secondary">
            {chat.lastMessagePreview}
          </span>
        )}
      </span>
      {time && <time className="shrink-0 text-xs text-ink-muted">{time}</time>}
    </button>
  );
}

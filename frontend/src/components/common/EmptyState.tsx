/** Props for the shared empty state (010 data-model §2.1). */
export interface EmptyStateProps {
  /** Localized title. */
  title: string;
  /** Optional localized description. */
  message?: string;
  /** Optional action button label. */
  actionLabel?: string;
  /** Optional action button callback. */
  onAction?: () => void;
}

/**
 * Reusable empty state for wizard screens: a titled, neutral panel with an
 * optional call to action (e.g. "no chats found" → "Retry").
 */
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="font-medium text-gray-700">{title}</p>
      {message !== undefined && <p className="text-sm text-gray-500">{message}</p>}
      {actionLabel !== undefined && onAction !== undefined && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

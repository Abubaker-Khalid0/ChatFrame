/** Props for the shared error state (010 data-model §2.1). */
export interface ErrorStateProps {
  /** Localized error title. */
  title: string;
  /** Optional localized, user-safe error description. */
  message?: string;
  /** Optional retry button label. */
  retryLabel?: string;
  /** Optional retry callback. */
  onRetry?: () => void;
  /** Optional back button label. */
  backLabel?: string;
  /** Optional back callback. */
  onBack?: () => void;
}

/**
 * Reusable error state for wizard screens. Uses `role="alert"` so screen
 * readers announce the failure immediately (010 data-model §5.2), with
 * optional retry/back recovery actions (US1 — every error is actionable).
 */
export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
  backLabel,
  onBack,
}: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-center">
      <p className="font-semibold text-red-700">{title}</p>
      {message !== undefined && <p className="mt-1 text-sm text-red-600">{message}</p>}
      {(onRetry !== undefined || onBack !== undefined) && (
        <div className="mt-4 flex justify-center gap-3">
          {retryLabel !== undefined && onRetry !== undefined && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {retryLabel}
            </button>
          )}
          {backLabel !== undefined && onBack !== undefined && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {backLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

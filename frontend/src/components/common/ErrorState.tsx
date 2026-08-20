import { AlertCircle } from 'lucide-react';
import { Button } from '../ui';

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
 * Reusable error state for workflow stages. Uses `role="alert"` so screen
 * readers announce the failure immediately, pairs the color with an icon
 * (never color alone), and offers optional retry/back recovery actions.
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
    <div
      role="alert"
      className="rounded-[var(--radius-card)] border border-error/30 bg-error-soft p-4 text-center"
    >
      <AlertCircle size={20} aria-hidden="true" className="mx-auto mb-2 text-error" />
      <p className="font-semibold text-error">{title}</p>
      {message !== undefined && <p className="mt-1 text-sm text-error/90">{message}</p>}
      {(onRetry !== undefined || onBack !== undefined) && (
        <div className="mt-4 flex justify-center gap-3">
          {retryLabel !== undefined && onRetry !== undefined && (
            <Button variant="primary" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {backLabel !== undefined && onBack !== undefined && (
            <Button variant="secondary" onClick={onBack}>
              {backLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

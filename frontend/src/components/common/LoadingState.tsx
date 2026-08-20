import { Spinner } from '../ui';

/** Props for the shared loading indicator (010 data-model §2.1). */
export interface LoadingStateProps {
  /** Localized loading message. */
  message: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable loading state for workflow stages. Announces itself politely to
 * screen readers and renders the shared accent spinner.
 */
export function LoadingState({ message, size = 'md' }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 py-8 text-center"
    >
      <Spinner size={size} />
      <p className="text-ink-muted">{message}</p>
    </div>
  );
}

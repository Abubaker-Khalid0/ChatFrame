/** Props for the shared loading indicator (010 data-model §2.1). */
export interface LoadingStateProps {
  /** Localized loading message. */
  message: string;
  size?: 'sm' | 'md' | 'lg';
}

const SPINNER_SIZE: Record<NonNullable<LoadingStateProps['size']>, string> = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-10 w-10 border-4',
};

/**
 * Reusable loading state for wizard screens. Announces itself politely to
 * screen readers (010 data-model §5.2) and renders a spinner consistent with
 * the export modal's visual treatment.
 */
export function LoadingState({ message, size = 'md' }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 py-8 text-center"
    >
      <div
        aria-hidden="true"
        className={`animate-spin rounded-full border-gray-200 border-t-emerald-600 ${SPINNER_SIZE[size]}`}
      />
      <p className="text-gray-500">{message}</p>
    </div>
  );
}

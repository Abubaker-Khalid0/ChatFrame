import { cn } from './cn';

const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
} as const;

/** Accent-colored loading spinner. Decorative — wrap with a live region for SR. */
export function Spinner({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block animate-spin rounded-full border-line-strong border-t-accent',
        SIZES[size],
        className,
      )}
    />
  );
}

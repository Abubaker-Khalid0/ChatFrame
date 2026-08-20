import { cn } from './cn';

/**
 * Slim determinate/indeterminate progress bar. When `value`/`max` are provided
 * it renders a determinate fill with proper ARIA; otherwise it animates as an
 * indeterminate track for stages with no known total.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value?: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const determinate = typeof value === 'number' && max > 0;
  const pct = determinate ? Math.min(100, Math.max(0, (value / max) * 100)) : undefined;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? max : undefined}
      aria-valuenow={determinate ? value : undefined}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
    >
      {determinate ? (
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      ) : (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/70" />
      )}
    </div>
  );
}

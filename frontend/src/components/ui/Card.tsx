import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * Card / panel surface: white background, thin neutral border, soft minimal
 * shadow. The default building block for a workflow stage. `padded` adds the
 * standard internal padding; turn it off when a stage needs edge-to-edge
 * sections (header/body/footer) and pad them individually.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  /** Large panels use a slightly larger radius. */
  size?: 'card' | 'panel';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padded = true, size = 'card', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'border border-line bg-surface shadow-[var(--shadow-card)]',
        size === 'panel' ? 'rounded-[var(--radius-panel)]' : 'rounded-[var(--radius-card)]',
        padded && 'p-6',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

/** Standard card heading block: title + optional description and trailing slot. */
export function CardHeader({
  title,
  description,
  trailing,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description !== undefined && (
          <p className="mt-1 text-sm text-ink-secondary">{description}</p>
        )}
      </div>
      {trailing !== undefined && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

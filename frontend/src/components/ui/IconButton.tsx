import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name — icon-only buttons have no visible text. */
  'aria-label': string;
  variant?: 'ghost' | 'secondary';
  size?: 'sm' | 'md';
  children: ReactNode;
}

const SIZES = { sm: 'h-8 w-8', md: 'h-10 w-10' } as const;

/** Icon-only button. Always requires an `aria-label`. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-control)] text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'secondary' && 'border border-line bg-surface',
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

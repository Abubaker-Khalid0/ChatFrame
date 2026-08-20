import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button without changing its footprint. */
  loading?: boolean;
  /** Optional leading icon (e.g. a Lucide icon element). */
  leadingIcon?: ReactNode;
  /** Stretch to the full width of the container. */
  block?: boolean;
}

const BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-[var(--radius-input)] font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-active',
  secondary:
    'border border-line bg-surface text-ink hover:bg-surface-hover active:bg-surface-muted',
  ghost: 'text-ink-secondary hover:bg-surface-hover hover:text-ink',
  destructive: 'bg-error text-white hover:brightness-95 active:brightness-90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

/**
 * Shared button primitive. One visual system for every primary/secondary/ghost/
 * destructive action across the dashboard. Loading state overlays a spinner and
 * hides the label without shifting layout (the label keeps its width).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    leadingIcon,
    block = false,
    className,
    children,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className)}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="absolute inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
        />
      )}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {leadingIcon}
        {children}
      </span>
    </button>
  );
});

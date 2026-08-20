import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Inline label rendered next to the box. */
  label?: ReactNode;
  /** Optional secondary description under the label. */
  description?: ReactNode;
}

/**
 * Checkbox styled with the accent color. When `label`/`description` are given it
 * renders a full clickable row; otherwise it renders the bare input so callers
 * can compose their own label (e.g. the disabled "always-on" import option).
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, ...rest },
  ref,
) {
  const box = (
    <input
      ref={ref}
      type="checkbox"
      className={cn('h-4 w-4 shrink-0 accent-[var(--color-accent)]', className)}
      {...rest}
    />
  );
  if (label === undefined && description === undefined) {
    return box;
  }
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 text-sm',
        rest.disabled === true && 'cursor-not-allowed opacity-70',
      )}
    >
      <span className="mt-0.5">{box}</span>
      <span className="flex flex-col">
        <span className="font-medium text-ink">{label}</span>
        {description !== undefined && <span className="text-sm text-ink-muted">{description}</span>}
      </span>
    </label>
  );
});

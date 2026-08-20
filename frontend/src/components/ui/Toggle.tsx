import { type ReactNode } from 'react';
import { cn } from './cn';

/**
 * Accessible switch (ARIA `switch`) for boolean settings. Renders an optional
 * label/description row; the whole control toggles on click and is keyboard
 * operable as a button.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );

  if (label === undefined && description === undefined) {
    return control;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink">{label}</span>
        {description !== undefined && <span className="text-xs text-ink-muted">{description}</span>}
      </span>
      {control}
    </div>
  );
}

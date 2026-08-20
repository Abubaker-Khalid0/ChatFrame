import type { ReactNode } from 'react';
import { cn } from './cn';

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * Segmented radio group for small mutually-exclusive choices (e.g. theme
 * light/dark). Renders real radio inputs for accessibility, styled as a
 * compact segmented control.
 */
export function RadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
  legend,
  className,
}: {
  name: string;
  value: T;
  options: ReadonlyArray<RadioOption<T>>;
  onChange: (value: T) => void;
  legend?: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      {legend !== undefined && <legend className="text-sm font-medium text-ink">{legend}</legend>}
      <div className="inline-flex rounded-[var(--radius-input)] border border-line bg-surface-muted p-0.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'cursor-pointer rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-surface text-ink shadow-[var(--shadow-card)]'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

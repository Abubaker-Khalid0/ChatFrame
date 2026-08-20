import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from './cn';

const CONTROL =
  'h-10 w-full rounded-[var(--radius-input)] border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors hover:border-line-strong focus:border-accent disabled:cursor-not-allowed disabled:opacity-60';

/** Wraps a control with a label, optional help text, and validation message. */
export function FieldShell({
  label,
  htmlFor,
  help,
  error,
  className,
  children,
}: {
  label?: ReactNode;
  htmlFor?: string | undefined;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label !== undefined && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error !== undefined ? (
        <p className="text-xs text-error">{error}</p>
      ) : help !== undefined ? (
        <p className="text-xs text-ink-muted">{help}</p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
}

/** Standard text input with the shared control look and an optional label. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, help, error, className, id, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      id={id}
      className={cn(CONTROL, error !== undefined && 'border-error', className)}
      {...rest}
    />
  );
  if (label === undefined && help === undefined && error === undefined) {
    return input;
  }
  return (
    <FieldShell label={label} htmlFor={id} help={help} error={error}>
      {input}
    </FieldShell>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  help?: ReactNode;
}

/** Native select styled to match the shared control system. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, help, className, id, children, ...rest },
  ref,
) {
  const select = (
    <select ref={ref} id={id} className={cn(CONTROL, 'pe-8', className)} {...rest}>
      {children}
    </select>
  );
  if (label === undefined && help === undefined) {
    return select;
  }
  return (
    <FieldShell label={label} htmlFor={id} help={help}>
      {select}
    </FieldShell>
  );
});

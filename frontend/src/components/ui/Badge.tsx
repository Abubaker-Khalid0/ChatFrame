import type { ReactNode } from 'react';
import { cn } from './cn';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-secondary',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  error: 'bg-error-soft text-error',
  info: 'bg-info-soft text-info',
};

/**
 * Fully-rounded pill for short labels and statuses. Status communication never
 * relies on color alone — pass an `icon` and a textual `children` label so the
 * meaning survives for colorblind and screen-reader users.
 */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {icon !== undefined && <span className="inline-flex shrink-0 items-center">{icon}</span>}
      {children}
    </span>
  );
}

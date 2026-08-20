import type { ReactNode } from 'react';
import { Button } from '../ui';

/** Props for the shared empty state (010 data-model §2.1). */
export interface EmptyStateProps {
  /** Localized title. */
  title: string;
  /** Optional localized description. */
  message?: string;
  /** Optional action button label. */
  actionLabel?: string;
  /** Optional action button callback. */
  onAction?: () => void;
  /** Optional leading icon for the empty state. */
  icon?: ReactNode;
}

/**
 * Reusable empty state: a titled, neutral panel with an optional call to
 * action. Follows the dashboard design system (tokens + Button primitive).
 */
export function EmptyState({ title, message, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {icon !== undefined && <div className="mb-1 text-ink-muted">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {message !== undefined && <p className="text-sm text-ink-muted">{message}</p>}
      {actionLabel !== undefined && onAction !== undefined && (
        <Button variant="primary" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { cn } from '../../components/ui/cn';

/**
 * Standard padded, centered container for form-style workflow stages. Keeps
 * spacing and max-width consistent across the dashboard. `width` widens the
 * column for content-heavy stages (e.g. the quality report).
 */
export function StageLayout({
  children,
  width = 'md',
  className,
}: {
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const maxWidth = width === 'sm' ? 'max-w-lg' : width === 'lg' ? 'max-w-3xl' : 'max-w-xl';
  return (
    <div className={cn('mx-auto w-full px-4 py-8 md:px-6', maxWidth, className)}>{children}</div>
  );
}

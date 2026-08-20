import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from './cn';

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: dims the backdrop, centers a card, moves focus into
 * the dialog on open, and traps Tab focus within it. `onClose` (when provided)
 * fires on Escape; pass it as undefined for a non-dismissable blocking dialog
 * (e.g. an export in progress).
 */
export function Modal({
  open,
  onClose,
  label,
  className,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  /** Accessible name for the dialog. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onClose !== undefined) {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || node === null) {
        return;
      }
      const focusables = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (focusables.length === 0) {
        return;
      }
      const firstEl = focusables[0]!;
      const lastEl = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          'w-full max-w-sm rounded-[var(--radius-panel)] border border-line bg-surface p-6 shadow-[var(--shadow-pop)]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

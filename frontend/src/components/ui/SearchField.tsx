import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from './cn';

/**
 * Search input with a leading magnifier icon, matching the shared control
 * system. Direction-aware: the icon sits on the inline-start via logical
 * padding so RTL renders correctly.
 */
export const SearchField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchField({ className, ...rest }, ref) {
    return (
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
          size={16}
        />
        <input
          ref={ref}
          type="search"
          className={cn(
            'h-10 w-full rounded-[var(--radius-input)] border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted transition-colors hover:border-line-strong focus:border-accent',
            className,
          )}
          {...rest}
        />
      </div>
    );
  },
);

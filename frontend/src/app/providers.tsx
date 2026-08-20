import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useThemeStore } from '../stores/useThemeStore';

/**
 * Applies the selected language/direction to the document root whenever it
 * changes (Constitution XVI). Switching is immediate, with no navigation
 * (FR-020, AC-5).
 */
function DirectionEffect() {
  const language = useLanguageStore((s) => s.language);
  const direction = useLanguageStore((s) => s.direction);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = direction;
  }, [language, direction]);

  return null;
}

/**
 * Applies the dashboard theme (`data-theme` attribute) to the document root.
 * Components and globals.css use `[data-theme='dark']` selectors to swap tokens.
 */
function ThemeEffect() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}

/**
 * Application-wide providers: TanStack Query client for backend communication
 * (used by the health check in Phase 4) and the language/direction effect.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Local-only backend; avoid noisy retries/refetches by default.
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DirectionEffect />
      <ThemeEffect />
      {children}
    </QueryClientProvider>
  );
}

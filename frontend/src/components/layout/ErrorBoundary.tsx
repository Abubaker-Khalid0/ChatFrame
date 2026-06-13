import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getDictionary } from '../../i18n';
import { useLanguageStore } from '../../stores/useLanguageStore';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Global error boundary (010 T007): any uncaught render error shows a
 * localized, user-safe recovery screen instead of a blank page (US1/US2).
 *
 * Class component because React only exposes `getDerivedStateFromError` to
 * classes; the language is read imperatively from the Zustand store since
 * hooks are unavailable here.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Local console only — never leaves the machine (Constitution I).
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const t = getDictionary(useLanguageStore.getState().language);
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div
          role="alert"
          className="w-full max-w-md rounded-lg border border-red-300 bg-red-50 p-6 text-center"
        >
          <p className="font-semibold text-red-700">{t.appName}</p>
          <p className="mt-2 text-sm text-red-600">{t.errors.generic}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {t.common.retry}
          </button>
        </div>
      </div>
    );
  }
}

import { useTranslations } from '../../i18n';

/**
 * Blocking export modal (009 FR-026). While the export runs it shows a spinner
 * and "Exporting…" and cannot be dismissed; on failure it shows a user-safe
 * error with "Retry" and "Back to Preview" actions (FR-017). The overlay
 * intercepts all interaction with the settings screen behind it.
 */
export function ExportingModal({
  error,
  onRetry,
  onBack,
}: {
  /** User-safe error message, or null while the export is in progress. */
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  const t = useTranslations();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={error === null ? t.export.modal.exporting : t.export.modal.errorTitle}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-lg">
        {error === null ? (
          <div role="status" aria-live="polite">
            <div
              aria-hidden="true"
              className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600"
            />
            <p className="mt-4 text-lg font-semibold text-gray-900">{t.export.modal.exporting}</p>
          </div>
        ) : (
          <>
            <div role="alert">
              <p className="text-lg font-semibold text-gray-900">{t.export.modal.errorTitle}</p>
              <p className="mt-2 text-sm text-gray-600">{error}</p>
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {t.export.modal.retry}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
              >
                {t.export.modal.backToPreview}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { AlertCircle } from 'lucide-react';
import { useTranslations } from '../../i18n';
import { Button, Modal, Spinner } from '../ui';

/**
 * Blocking export modal (009 FR-026). While the export runs it shows a spinner
 * and "Exporting…" and cannot be dismissed; on failure it shows a user-safe
 * error with "Retry" and "Back to Preview". Built on the shared Modal primitive
 * (focus trap + backdrop).
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
    <Modal
      open
      label={error === null ? t.export.modal.exporting : t.export.modal.errorTitle}
      className="text-center"
    >
      {error === null ? (
        <div role="status" aria-live="polite">
          <Spinner size="lg" className="mx-auto" />
          <p className="mt-4 text-lg font-semibold text-ink">{t.export.modal.exporting}</p>
        </div>
      ) : (
        <>
          <div role="alert">
            <AlertCircle size={28} aria-hidden="true" className="mx-auto mb-2 text-error" />
            <p className="text-lg font-semibold text-ink">{t.export.modal.errorTitle}</p>
            <p className="mt-2 text-sm text-ink-secondary">{error}</p>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="primary" onClick={onRetry}>
              {t.export.modal.retry}
            </Button>
            <Button variant="secondary" onClick={onBack}>
              {t.export.modal.backToPreview}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

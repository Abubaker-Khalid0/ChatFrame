import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ImportStage } from '@chatframe/shared';
import { cancelImport, getImportStatus, startImport } from '../../api/import.api';
import { createImportEventsClient } from '../../api/importEvents';
import { useImportStore } from '../../stores/useImportStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useTranslations } from '../../i18n';
import { Button, Card, ProgressBar, Spinner } from '../../components/ui';
import { StageLayout } from './StageLayout';

/** Stages during which the Cancel button is enabled (FR-021, US4 AC-5). */
const CANCELLABLE_STAGES: ReadonlySet<ImportStage> = new Set<ImportStage>([
  'fetching_metadata',
  'fetching_messages',
  'saving_raw_messages',
  'downloading_images',
  'normalizing',
  'resolving_replies',
  'generating_quality_report',
  'preparing_preview',
]);

/** Simple `{placeholder}` interpolation matching the i18n convention. */
function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

/**
 * Real-time import progress (007 FR-019, FR-020). Subscribes to import events
 * for the lifetime of the stage, falls back to the status snapshot for late
 * joiners, and on completion advances to the quality stage. Failed/cancelled
 * imports stay here with Back-to-Chat-Picker and Retry. Ported from the former
 * ImportProgressPage; ids + the retry request now come from the workflow store.
 */
export function ImportProgressStage() {
  const t = useTranslations();
  const storeImportId = useWorkflowStore((s) => s.importId);
  const storeProjectId = useWorkflowStore((s) => s.projectId);
  const importRequest = useWorkflowStore((s) => s.importRequest);
  const completeImport = useWorkflowStore((s) => s.completeImport);
  const beginImport = useWorkflowStore((s) => s.beginImport);
  const backToChatPicker = useWorkflowStore((s) => s.backToChatPicker);

  const progress = useImportStore((s) => s.progress);
  const warnings = useImportStore((s) => s.warnings);
  const error = useImportStore((s) => s.error);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Live events: subscribe for the lifetime of the stage (FR-020).
  useEffect(() => {
    const client = createImportEventsClient();
    client.start();
    return () => client.stop();
  }, []);

  // Late-join fallback: read the snapshot once, then follow live events (FR-014).
  useEffect(() => {
    if (storeImportId === undefined || storeImportId === null) {
      return;
    }
    if (useImportStore.getState().progress !== null) {
      return;
    }
    void getImportStatus(storeImportId)
      .then((snapshot) => useImportStore.getState().applyProgress(snapshot))
      .catch(() => undefined);
  }, [storeImportId]);

  // Completion routing (FR-022): completed → quality stage.
  const stage = progress?.stage;
  const projectId = progress?.projectId ?? storeProjectId ?? undefined;
  useEffect(() => {
    if (stage === 'completed' && projectId !== undefined) {
      completeImport(projectId);
    }
  }, [stage, projectId, completeImport]);

  const handleCancel = async () => {
    const importId = progress?.importId ?? storeImportId ?? undefined;
    if (importId === undefined || cancelling) {
      return;
    }
    setCancelling(true);
    try {
      await cancelImport(importId);
    } catch {
      setCancelling(false);
    }
  };

  // Retry starts a fresh import in a new folder (FR-030, US4 AC-4).
  const handleRetry = async () => {
    if (importRequest === null || retrying) {
      backToChatPicker();
      return;
    }
    setRetrying(true);
    try {
      const response = await startImport(importRequest);
      useImportStore.getState().reset();
      setCancelling(false);
      setRetrying(false);
      beginImport({
        importId: response.importId,
        projectId: response.projectId,
        request: importRequest,
      });
    } catch {
      setRetrying(false);
    }
  };

  const stageLabel = stage !== undefined ? t.import.progress.stages[stage] : null;
  const isFailed = stage === 'failed';
  const isCancelled = stage === 'cancelled';
  const isTerminal = isFailed || isCancelled;
  const canCancel = stage !== undefined && CANCELLABLE_STAGES.has(stage) && !cancelling;

  const messagesLine =
    progress !== undefined && progress !== null
      ? progress.messagesTotal !== undefined
        ? fill(t.import.progress.messagesCount, {
            count: progress.messagesImported,
            total: progress.messagesTotal,
          })
        : fill(t.import.progress.messagesCountNoTotal, { count: progress.messagesImported })
      : null;

  const imagesLine =
    progress?.imagesTotal !== undefined
      ? fill(t.import.progress.imagesCount, {
          count: progress.imagesDownloaded,
          total: progress.imagesTotal,
        })
      : null;

  return (
    <StageLayout width="sm">
      <Card padded>
        <div className="flex items-center gap-3">
          {!isTerminal && <Spinner size="sm" />}
          <h1 className="text-2xl font-bold text-ink">
            {isFailed
              ? t.import.terminal.failedTitle
              : isCancelled
                ? t.import.terminal.cancelledTitle
                : t.import.progress.title}
          </h1>
        </div>

        {isFailed && (
          <p className="mt-4 text-error" role="alert">
            {error?.message ?? t.import.progress.stages.failed}
          </p>
        )}

        {!isFailed && stageLabel !== null && (
          <p className="mt-4 font-medium text-ink" aria-live="polite">
            {stageLabel}
          </p>
        )}

        {!isTerminal && (
          <ProgressBar
            className="mt-4"
            label={stageLabel ?? t.import.progress.title}
            {...(progress?.messagesTotal !== undefined
              ? { value: progress.messagesImported, max: progress.messagesTotal }
              : {})}
          />
        )}

        {messagesLine !== null && <p className="mt-3 text-ink-secondary">{messagesLine}</p>}
        {imagesLine !== null && <p className="mt-1 text-ink-secondary">{imagesLine}</p>}

        {warnings.length > 0 && (
          <div className="mt-6">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-warning">
              <AlertTriangle size={16} aria-hidden="true" />
              {t.import.progress.warningsTitle}
            </h2>
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-[var(--radius-input)] border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
              {warnings.map((warning) => (
                <li key={warning} className="py-0.5">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          {isTerminal ? (
            <>
              <Button variant="secondary" onClick={() => backToChatPicker()}>
                {t.import.terminal.backToChatPicker}
              </Button>
              <Button variant="primary" loading={retrying} onClick={() => void handleRetry()}>
                {t.import.terminal.retry}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              className="border-error/40 text-error hover:bg-error-soft"
              disabled={!canCancel}
              onClick={() => void handleCancel()}
            >
              {cancelling ? t.import.progress.cancelling : t.import.progress.cancel}
            </Button>
          )}
        </div>
      </Card>
    </StageLayout>
  );
}

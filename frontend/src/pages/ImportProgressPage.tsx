import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ImportStage, StartImportRequest } from '@chatframe/shared';
import { cancelImport, getImportStatus, startImport } from '../api/import.api';
import { createImportEventsClient } from '../api/importEvents';
import { useImportStore } from '../stores/useImportStore';
import { useTranslations } from '../i18n';

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

/** Navigation payload forwarded by the options screen (and by Retry). */
interface ProgressLocationState {
  importId?: string;
  projectId?: string;
  request?: StartImportRequest;
}

/** Simple `{placeholder}` interpolation matching the i18n convention. */
function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

/**
 * Wizard step 2b: real-time import progress over SSE (007 FR-019, FR-020).
 * Shows the current stage, message/image counts, and a scrollable warnings
 * list; Cancel is enabled only during cancellable stages (FR-021). On
 * completion the user moves to the quality screen; failed/cancelled imports
 * stay here with Back-to-Chat-Picker and Retry (FR-022, FR-030).
 */
export function ImportProgressPage() {
  const t = useTranslations();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as ProgressLocationState | null) ?? {};

  const progress = useImportStore((s) => s.progress);
  const warnings = useImportStore((s) => s.warnings);
  const error = useImportStore((s) => s.error);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Live events: subscribe for the lifetime of the screen (FR-020).
  useEffect(() => {
    const client = createImportEventsClient();
    client.start();
    return () => client.stop();
  }, []);

  // Late-join fallback: a client that missed events reads the snapshot once
  // and then follows live events (FR-014; contracts/import-api.md).
  const stateImportId = state.importId;
  useEffect(() => {
    if (stateImportId === undefined || useImportStore.getState().progress !== null) {
      return;
    }
    void getImportStatus(stateImportId)
      .then((snapshot) => useImportStore.getState().applyProgress(snapshot))
      .catch(() => undefined);
  }, [stateImportId]);

  // Completion routing (FR-022): completed → quality screen.
  const stage = progress?.stage;
  const projectId = progress?.projectId ?? state.projectId;
  useEffect(() => {
    if (stage === 'completed') {
      navigate('/quality', { state: { projectId } });
    }
  }, [stage, projectId, navigate]);

  const handleCancel = async () => {
    const importId = progress?.importId ?? state.importId;
    if (importId === undefined || cancelling) {
      return;
    }
    setCancelling(true);
    try {
      await cancelImport(importId);
    } catch {
      // The terminal event (or status fallback) reports the actual outcome.
      setCancelling(false);
    }
  };

  // Retry starts a fresh import in a new folder (FR-030, US4 AC-4).
  const handleRetry = async () => {
    const request = state.request;
    if (request === undefined || retrying) {
      navigate('/chat-picker');
      return;
    }
    setRetrying(true);
    try {
      const response = await startImport(request);
      useImportStore.getState().reset();
      setCancelling(false);
      setRetrying(false);
      navigate('/import/progress', {
        replace: true,
        state: { importId: response.importId, projectId: response.projectId, request },
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
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">
        {isFailed
          ? t.import.terminal.failedTitle
          : isCancelled
            ? t.import.terminal.cancelledTitle
            : t.import.progress.title}
      </h1>

      {isFailed && (
        <p className="mt-4 text-red-600" role="alert">
          {error?.message ?? t.import.progress.stages.failed}
        </p>
      )}

      {!isFailed && stageLabel !== null && (
        <p className="mt-4 font-medium text-gray-800" aria-live="polite">
          {stageLabel}
        </p>
      )}

      {messagesLine !== null && <p className="mt-2 text-gray-600">{messagesLine}</p>}
      {imagesLine !== null && <p className="mt-1 text-gray-600">{imagesLine}</p>}

      {warnings.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-amber-700">
            {t.import.progress.warningsTitle}
          </h2>
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
            <button
              type="button"
              onClick={() => navigate('/chat-picker')}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
            >
              {t.import.terminal.backToChatPicker}
            </button>
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retrying}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {t.import.terminal.retry}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={!canCancel}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:border-red-300 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
          >
            {cancelling ? t.import.progress.cancelling : t.import.progress.cancel}
          </button>
        )}
      </div>
    </section>
  );
}

import { useTranslations } from '../../i18n';
import { useQualityReport } from '../../api/normalization.api';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { Button } from '../../components/ui';
import { QualityMetricCards } from './components/QualityMetricCards';
import { QualityWarningList } from './components/QualityWarningList';
import { FatalErrorBanner } from './components/FatalErrorBanner';
import { MissingImageNotice } from './components/MissingImageNotice';
import { canContinueToPreview } from './qualityView';

export interface QualityReportScreenProps {
  projectId: string;
  onBack: () => void;
  onContinue: () => void;
}

/**
 * Quality Report screen (US8). Reads the backend report and renders summary
 * metrics, warnings, a fatal-error banner, and a missing-image notice. The
 * "Continue to preview" action is enabled only when there is no fatal error
 * (US8 AC1–AC3, FR-017/FR-018). The screen renders the report verbatim and
 * contains no normalization logic (FR-016).
 *
 * Robustness (Phase 10): distinguishes between "loading/retrying" and "truly
 * unavailable" so the user sees a spinner during the brief window between
 * import completion and report availability, and only sees the "unavailable"
 * message when the report genuinely cannot be fetched after retries.
 */
export function QualityReportScreen({ projectId, onBack, onContinue }: QualityReportScreenProps) {
  const t = useTranslations();
  const { data: report, isLoading, isFetching, isError, refetch } = useQualityReport(projectId);
  const canContinue = canContinueToPreview(report);

  // Show loading when the initial load is in progress OR when retrying after
  // an error (isFetching covers both). This prevents the "unavailable" message
  // from flashing during the brief retry window after import completes.
  const showLoading = isLoading || (isFetching && !report);

  return (
    <section className="flex w-full max-w-2xl flex-col rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <header className="border-b border-line px-6 py-4">
        <h1 className="text-xl font-semibold text-ink">{t.quality.title}</h1>
        <p className="mt-1 text-sm text-ink-secondary">{t.quality.subtitle}</p>
      </header>

      <div className="flex-1 space-y-4 px-6 py-5">
        {showLoading ? (
          <LoadingState message={t.quality.loading} />
        ) : !report ? (
          <div className="space-y-3">
            <EmptyState title={t.quality.unavailable} />
            {isError && (
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => void refetch()}>
                  {t.common.retry}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <FatalErrorBanner errors={report.errors} />
            <QualityMetricCards report={report} />
            <MissingImageNotice count={report.missingImages} />
            <QualityWarningList warnings={report.warnings} />
          </>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-line px-6 py-3">
        <Button variant="secondary" onClick={onBack}>
          {t.wizard.back}
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={!canContinue}>
          {t.quality.continueToPreview}
        </Button>
      </footer>
    </section>
  );
}

import { useTranslations } from '../../i18n';
import { useQualityReport } from '../../api/normalization.api';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
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
 */
export function QualityReportScreen({ projectId, onBack, onContinue }: QualityReportScreenProps) {
  const t = useTranslations();
  const { data: report, isLoading } = useQualityReport(projectId);
  const canContinue = canContinueToPreview(report);

  return (
    <section className="flex w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold">{t.quality.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.quality.subtitle}</p>
      </header>

      <div className="flex-1 space-y-4 px-6 py-5">
        {isLoading ? (
          <LoadingState message={t.quality.loading} />
        ) : !report ? (
          <EmptyState title={t.quality.unavailable} />
        ) : (
          <>
            <FatalErrorBanner errors={report.errors} />
            <QualityMetricCards report={report} />
            <MissingImageNotice count={report.missingImages} />
            <QualityWarningList warnings={report.warnings} />
          </>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
        >
          {t.wizard.back}
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.quality.continueToPreview}
        </button>
      </footer>
    </section>
  );
}

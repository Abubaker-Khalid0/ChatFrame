import type { QualityReport } from '@chatframe/shared';
import { useTranslations } from '../../../i18n';
import { unsupportedTotal } from '../qualityView';

/** Formats an ISO date range as `YYYY-MM-DD → YYYY-MM-DD`, or a dash. */
function formatDateRange(from: string | null, to: string | null): string {
  if (!from || !to) {
    return '—';
  }
  return `${from.slice(0, 10)} → ${to.slice(0, 10)}`;
}

/** Summary metric cards for the quality report (US8). */
export function QualityMetricCards({ report }: { report: QualityReport }) {
  const t = useTranslations();
  const m = t.quality.metrics;

  const cards: Array<{ label: string; value: string | number }> = [
    { label: m.totalRawMessages, value: report.totalRawMessages },
    { label: m.totalNormalizedMessages, value: report.totalNormalizedMessages },
    { label: m.duplicatesRemoved, value: report.duplicatesRemoved },
    { label: m.unresolvedReplies, value: report.unresolvedReplies },
    { label: m.missingImages, value: report.missingImages },
    { label: m.unsupportedTypes, value: unsupportedTotal(report) },
    { label: m.dateRange, value: formatDateRange(report.dateRange.from, report.dateRange.to) },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <li key={card.label} className="rounded-lg border border-line bg-surface-muted p-3">
          <p className="text-xs font-medium text-ink-muted">{card.label}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{card.value}</p>
        </li>
      ))}
    </ul>
  );
}

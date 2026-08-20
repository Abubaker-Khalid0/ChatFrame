import type { QualityWarning } from '@chatframe/shared';
import { useTranslations } from '../../../i18n';

/** Lists non-fatal quality warnings, or a reassuring empty state (US8 AC1). */
export function QualityWarningList({ warnings }: { warnings: QualityWarning[] }) {
  const t = useTranslations();

  if (warnings.length === 0) {
    return <p className="text-sm text-ink-muted">{t.quality.noWarnings}</p>;
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-ink-secondary">{t.quality.warningsTitle}</h2>
      <ul className="mt-2 space-y-1">
        {warnings.map((warning, index) => (
          <li
            key={`${warning.code}-${index}`}
            className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-ink"
          >
            <span className="font-mono text-xs text-warning">{warning.code}</span>
            <span>{warning.message}</span>
            {typeof warning.count === 'number' && (
              <span className="ms-auto font-semibold">×{warning.count}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

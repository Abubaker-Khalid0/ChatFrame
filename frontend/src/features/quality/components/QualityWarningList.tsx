import type { QualityWarning } from '@chatframe/shared';
import { useTranslations } from '../../../i18n';

/** Lists non-fatal quality warnings, or a reassuring empty state (US8 AC1). */
export function QualityWarningList({ warnings }: { warnings: QualityWarning[] }) {
  const t = useTranslations();

  if (warnings.length === 0) {
    return <p className="text-sm text-gray-500">{t.quality.noWarnings}</p>;
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700">{t.quality.warningsTitle}</h2>
      <ul className="mt-2 space-y-1">
        {warnings.map((warning, index) => (
          <li
            key={`${warning.code}-${index}`}
            className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            <span className="font-mono text-xs text-amber-600">{warning.code}</span>
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

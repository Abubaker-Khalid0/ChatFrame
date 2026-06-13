import type { QualityError } from '@chatframe/shared';
import { useTranslations } from '../../../i18n';

/** Prominent banner shown when the report has a fatal error (US8 AC2, FR-018). */
export function FatalErrorBanner({ errors }: { errors: QualityError[] }) {
  const t = useTranslations();
  const fatal = errors.filter((error) => error.fatal);
  if (fatal.length === 0) {
    return null;
  }

  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4">
      <h2 className="text-sm font-bold text-red-800">{t.quality.fatalTitle}</h2>
      <p className="mt-1 text-sm text-red-700">{t.quality.fatalBody}</p>
      <ul className="mt-2 space-y-1">
        {fatal.map((error, index) => (
          <li key={`${error.code}-${index}`} className="text-xs text-red-600">
            {error.code}: {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

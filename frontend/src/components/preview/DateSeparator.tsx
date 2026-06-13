import { useLanguageStore } from '../../stores/useLanguageStore';

const LOCALES: Record<string, string> = { en: 'en-US', ar: 'ar' };

/**
 * Centered pill badge separating messages from different days (008 FR-009),
 * rendered from the row's `dateKey` with a localized long date.
 */
export function DateSeparator({ dateKey }: { dateKey: string }) {
  const language = useLanguageStore((s) => s.language);

  // `dateKey` is a YYYY-MM-DD string; parse as UTC midnight for stable output.
  const label = new Intl.DateTimeFormat(LOCALES[language] ?? language, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));

  return (
    <div className="cf-date">
      <span className="cf-date__badge">{label}</span>
    </div>
  );
}

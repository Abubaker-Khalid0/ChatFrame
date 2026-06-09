import { LANGUAGES, type Language } from '@chatframe/shared';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useTranslations } from '../../i18n';

/**
 * Language switcher available from the app shell on every screen (FR-020).
 * Changing the language updates the interface and direction immediately,
 * without navigating away (AC-5).
 */
export function LanguageSwitcher() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const t = useTranslations();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{t.language.label}</span>
      <div className="flex gap-1" role="group" aria-label={t.language.label}>
        {LANGUAGES.map((code: Language) => {
          const isActive = code === language;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              aria-pressed={isActive}
              className={[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              ].join(' ')}
            >
              {t.language[code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

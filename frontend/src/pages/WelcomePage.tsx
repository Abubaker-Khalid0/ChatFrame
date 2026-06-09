import { useNavigate } from 'react-router-dom';
import { LANGUAGES, type Language } from '@chatframe/shared';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useTranslations } from '../i18n';

/**
 * First-run welcome screen (FR-001/FR-002): states the local-first, read-only
 * trust message in the selected language and offers a language choice.
 * Selecting a language updates the interface direction immediately (AC-2/AC-3);
 * "Continue" records the choice and moves to the next step (FR-019).
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const confirm = useLanguageStore((s) => s.confirm);
  const t = useTranslations();

  const handleContinue = () => {
    confirm();
    navigate('/next');
  };

  return (
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">{t.welcome.title}</h1>
      <p className="mt-4 text-gray-700">{t.welcome.localFirst}</p>
      <p className="mt-2 text-gray-700">{t.welcome.readOnly}</p>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-medium text-gray-600">{t.welcome.choosePrompt}</legend>
        <div className="flex gap-3">
          {LANGUAGES.map((code: Language) => {
            const isActive = code === language;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                aria-pressed={isActive}
                className={[
                  'flex-1 rounded-lg border px-4 py-3 text-base font-medium transition-colors',
                  isActive
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                ].join(' ')}
              >
                {t.language[code]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={handleContinue}
        className="mt-8 w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {t.welcome.continue}
      </button>
    </section>
  );
}

import { useNavigate } from 'react-router-dom';
import { useTranslations } from '../i18n';

/**
 * Wizard hub (FR-009): the landing screen for returning users. It introduces
 * the export flow and starts it at the chat picker. A short note makes the
 * synthetic mock-data context explicit during this phase.
 */
export function NextStepPage() {
  const t = useTranslations();
  const navigate = useNavigate();

  return (
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">{t.nextStep.title}</h1>
      <p className="mt-4 text-gray-700">{t.nextStep.body}</p>

      <button
        type="button"
        onClick={() => navigate('/chat-picker')}
        className="mt-8 w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {t.nextStep.start}
      </button>

      <p className="mt-4 text-xs text-gray-400">{t.nextStep.mockNote}</p>
    </section>
  );
}

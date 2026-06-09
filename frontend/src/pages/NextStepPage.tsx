import { useTranslations } from '../i18n';

/**
 * Placeholder destination after the welcome flow (FR-019): a friendly
 * "coming soon" message in the selected language. Returning users land here
 * directly (FR-021, handled by the route guard).
 */
export function NextStepPage() {
  const t = useTranslations();

  return (
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">{t.nextStep.title}</h1>
      <p className="mt-4 text-gray-700">{t.nextStep.body}</p>
    </section>
  );
}

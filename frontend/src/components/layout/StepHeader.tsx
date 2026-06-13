import { useLocation } from 'react-router-dom';
import { useTranslations } from '../../i18n';

/** Wizard step routes in order; prefixes also match sub-routes. */
const STEP_ROUTES: ReadonlyArray<{
  prefix: string;
  key: 'chatPicker' | 'import' | 'quality' | 'preview' | 'export';
}> = [
  { prefix: '/chat-picker', key: 'chatPicker' },
  { prefix: '/import', key: 'import' },
  { prefix: '/quality', key: 'quality' },
  { prefix: '/preview', key: 'preview' },
  { prefix: '/export', key: 'export' },
];

/** Simple `{placeholder}` interpolation matching the i18n convention. */
function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

/**
 * Wizard progress header (010 T033, data-model §5.2): shows "Step N of M:
 * Step Name" with an equivalent `aria-label` so screen readers announce the
 * position in the flow. Renders nothing outside the wizard routes.
 */
export function StepHeader() {
  const t = useTranslations();
  const { pathname } = useLocation();

  const index = STEP_ROUTES.findIndex(({ prefix }) => pathname.startsWith(prefix));
  if (index === -1) {
    return null;
  }
  const step = STEP_ROUTES[index];
  if (step === undefined) {
    return null;
  }

  const label = fill(t.a11y.wizardProgress, {
    current: index + 1,
    total: STEP_ROUTES.length,
    name: t.wizard.steps[step.key],
  });

  return (
    <nav aria-label={label} className="border-b border-gray-200 bg-white px-6 py-2">
      <div className="flex items-center gap-3">
        <ol className="flex items-center gap-1.5" aria-hidden="true">
          {STEP_ROUTES.map(({ prefix }, i) => (
            <li
              key={prefix}
              className={[
                'h-1.5 rounded-full transition-all',
                i === index
                  ? 'w-6 bg-emerald-600'
                  : i < index
                    ? 'w-3 bg-emerald-300'
                    : 'w-3 bg-gray-200',
              ].join(' ')}
            />
          ))}
        </ol>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
    </nav>
  );
}

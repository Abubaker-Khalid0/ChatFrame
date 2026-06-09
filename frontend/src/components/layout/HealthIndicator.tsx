import { useTranslations } from '../../i18n';
import { useHealth } from '../../api/health.api';

/**
 * Compact backend readiness indicator shown in the app shell header. Renders a
 * clear, non-technical message in the selected language when the backend is
 * unavailable rather than a raw error (FR-010, Constitution XIX).
 */
export function HealthIndicator() {
  const t = useTranslations();
  const { data, isError, isLoading } = useHealth();

  const isReady = data?.status === 'ok';

  const { dotClass, label } = isReady
    ? { dotClass: 'bg-emerald-500', label: t.health.ready }
    : isError
      ? { dotClass: 'bg-red-500', label: t.health.notReady }
      : { dotClass: 'bg-amber-400', label: t.health.checking };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600" role="status" aria-live="polite">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}${isLoading ? ' animate-pulse' : ''}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}

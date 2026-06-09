import { Outlet } from 'react-router-dom';
import { useTranslations } from '../../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { HealthIndicator } from './HealthIndicator';

/**
 * Application shell: a persistent header hosting the language switcher
 * (available on every screen, FR-018/FR-020), the backend readiness indicator
 * (FR-010), and an outlet for the active screen. Flex layout respects the
 * document direction.
 */
export function AppShell() {
  const t = useTranslations();

  return (
    <div className="flex min-h-full flex-col bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold">{t.appName}</span>
          <HealthIndicator />
        </div>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <Outlet />
      </main>
    </div>
  );
}

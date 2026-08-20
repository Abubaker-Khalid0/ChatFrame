import { Moon, Sun, Plus, MessageCircle, LogOut } from 'lucide-react';
import { useTranslations } from '../i18n';
import { useSessionStore } from '../stores/useSessionStore';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useWorkflowStore } from '../stores/useWorkflowStore';
import { useThemeStore } from '../stores/useThemeStore';
import { useLogout } from '../api/session.api';
import { LANGUAGES, type Language } from '@chatframe/shared';

/**
 * Top header bar matching the reference design:
 * - Left: Breadcrumb "ChatFrame / Workspace"
 * - Right: Language segmented control, theme toggle, WhatsApp status chip, New Import button
 */
export function TopBar() {
  const t = useTranslations();
  const state = useSessionStore((s) => s.state);
  const startNewImport = useWorkflowStore((s) => s.startNewImport);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const themeToggle = useThemeStore((s) => s.toggle);
  const theme = useThemeStore((s) => s.theme);
  const logout = useLogout();

  const isConnected = state === 'connected';

  return (
    <header className="flex h-[78px] shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-5">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[15px]">
        <span className="font-medium text-ink-muted">{t.appName}</span>
        <span className="text-ink-muted">/</span>
        <span className="font-semibold text-ink">{t.dashboard.workspace}</span>
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Language segmented control */}
        <div
          className="flex gap-0.5 rounded-[12px] border border-line bg-surface-muted p-0.5"
          role="group"
          aria-label={t.language.label}
        >
          {LANGUAGES.map((code: Language) => {
            const isActive = code === language;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                aria-pressed={isActive}
                className={[
                  'rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-surface text-ink shadow-[var(--shadow-card)]'
                    : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                {code.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Theme toggle button */}
        <button
          type="button"
          onClick={themeToggle}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          aria-label={t.dashboard.toggleTheme}
          aria-pressed={theme === 'dark'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* WhatsApp status chip */}
        <div
          className={[
            'flex items-center gap-2 rounded-[12px] border px-3 py-1.5 text-xs font-medium',
            isConnected
              ? 'border-accent-border bg-accent-soft text-accent'
              : 'border-line bg-surface text-ink-secondary',
          ].join(' ')}
        >
          <MessageCircle
            size={14}
            className={isConnected ? 'text-accent' : 'text-orange-500'}
          />
          <span>
            {isConnected ? t.session.whatsappConnected : t.session.whatsappDisconnected}
          </span>
        </div>

        {/* Disconnect button — visible only when connected */}
        {isConnected && (
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex items-center gap-1.5 rounded-[12px] border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            aria-label={t.session.logout}
          >
            <LogOut size={14} />
            <span>{t.session.logout}</span>
          </button>
        )}

        {/* New Import button */}
        <button
          type="button"
          onClick={() => startNewImport()}
          className="flex items-center gap-1.5 rounded-[12px] bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-active"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/50">
            <Plus size={10} />
          </span>
          <span>{t.session.newImport}</span>
        </button>
      </div>
    </header>
  );
}

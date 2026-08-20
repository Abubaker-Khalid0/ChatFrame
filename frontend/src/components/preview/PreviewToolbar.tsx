import { Moon, Sun } from 'lucide-react';
import {
  PREVIEW_FONT_SCALE_MAX,
  PREVIEW_FONT_SCALE_MIN,
  PREVIEW_WIDTH_MAX_PX,
  PREVIEW_WIDTH_MIN_PX,
} from '@chatframe/shared';
import { useTranslations } from '../../i18n';
import { usePreviewSettingsStore } from '../../stores/usePreviewSettingsStore';

/**
 * Preview controls (008 FR-017/018/019/021): light/dark toggle, font-size and
 * width sliders, and real-time privacy toggles. All controls write to
 * {@link usePreviewSettingsStore}; the chat root reacts via `data-theme` and
 * CSS custom properties, so nothing here ever triggers a reload or re-fetch.
 * Navigation to export now lives in the stage footer. The toolbar is app chrome
 * (design-system tokens); only the conversation panel uses chat-renderer.css.
 */
export function PreviewToolbar({ projectId: _projectId }: { projectId: string }) {
  const t = useTranslations();
  const theme = usePreviewSettingsStore((s) => s.theme);
  const fontScale = usePreviewSettingsStore((s) => s.fontScale);
  const widthPx = usePreviewSettingsStore((s) => s.widthPx);
  const privacy = usePreviewSettingsStore((s) => s.privacy);
  const setTheme = usePreviewSettingsStore((s) => s.setTheme);
  const setFontScale = usePreviewSettingsStore((s) => s.setFontScale);
  const setWidthPx = usePreviewSettingsStore((s) => s.setWidthPx);
  const setPrivacy = usePreviewSettingsStore((s) => s.setPrivacy);

  const isDark = theme === 'dark';

  return (
    <div
      role="toolbar"
      aria-label={t.preview.toolbar.label}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3 text-sm md:px-6"
    >
      {/* Theme toggle (FR-017, US3). */}
      <button
        type="button"
        aria-pressed={isDark}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-1.5 font-medium text-ink transition-colors hover:bg-surface-hover"
      >
        {isDark ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        {t.preview.toolbar.themeToggle}:{' '}
        {isDark ? t.preview.toolbar.themeDark : t.preview.toolbar.themeLight}
      </button>

      {/* Font-size control (FR-018, US5). */}
      <label className="flex items-center gap-2 text-ink-secondary">
        {t.preview.toolbar.fontSize}
        <input
          type="range"
          min={PREVIEW_FONT_SCALE_MIN}
          max={PREVIEW_FONT_SCALE_MAX}
          step={0.1}
          value={fontScale}
          aria-label={t.preview.toolbar.fontSize}
          onChange={(e) => setFontScale(Number(e.target.value))}
          className="accent-[var(--color-accent)]"
        />
      </label>

      {/* Width control (FR-019, US5). */}
      <label className="flex items-center gap-2 text-ink-secondary">
        {t.preview.toolbar.width}
        <input
          type="range"
          min={PREVIEW_WIDTH_MIN_PX}
          max={PREVIEW_WIDTH_MAX_PX}
          step={10}
          value={widthPx}
          aria-label={t.preview.toolbar.width}
          onChange={(e) => setWidthPx(Number(e.target.value))}
          className="accent-[var(--color-accent)]"
        />
      </label>

      {/* Privacy toggles (FR-021, US6) — applied client-side, no re-fetch. */}
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="sr-only">{t.preview.toolbar.privacy}</legend>
        <label className="flex items-center gap-1.5 text-ink-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-accent)]"
            checked={privacy.showContactName}
            onChange={(e) => setPrivacy({ ...privacy, showContactName: e.target.checked })}
          />
          {t.preview.toolbar.showContactName}
        </label>
        <label className="flex items-center gap-1.5 text-ink-secondary">
          {t.preview.toolbar.displayAlias}
          <input
            type="text"
            value={privacy.displayAlias ?? ''}
            placeholder={t.preview.toolbar.displayAliasPlaceholder}
            onChange={(e) => {
              const alias = e.target.value;
              setPrivacy(
                alias.trim().length > 0
                  ? { ...privacy, displayAlias: alias }
                  : {
                      showContactName: privacy.showContactName,
                      showPhoneNumber: privacy.showPhoneNumber,
                    },
              );
            }}
            className="w-32 rounded-[var(--radius-control)] border border-line bg-surface px-2 py-1 text-ink"
          />
        </label>
        <label className="flex items-center gap-1.5 text-ink-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-accent)]"
            checked={privacy.showPhoneNumber}
            onChange={(e) => setPrivacy({ ...privacy, showPhoneNumber: e.target.checked })}
          />
          {t.preview.toolbar.showPhoneNumber}
        </label>
      </fieldset>
    </div>
  );
}

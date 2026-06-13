import { useNavigate } from 'react-router-dom';
import {
  PREVIEW_FONT_SCALE_MAX,
  PREVIEW_FONT_SCALE_MIN,
  PREVIEW_WIDTH_MAX_PX,
  PREVIEW_WIDTH_MIN_PX,
} from '@chatframe/shared';
import { useTranslations } from '../../i18n';
import { usePreviewSettingsStore } from '../../stores/usePreviewSettingsStore';

/**
 * Preview controls (008 FR-017/018/019/021/028): light/dark toggle, font-size
 * and width sliders, real-time privacy toggles, and navigation to the export
 * settings. All controls write to {@link usePreviewSettingsStore}; the chat
 * root reacts via `data-theme` and CSS custom properties, so no change here
 * ever causes a reload or re-fetch. The toolbar itself is app chrome
 * (Tailwind); only the conversation panel uses `chat-renderer.css`.
 */
export function PreviewToolbar({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const navigate = useNavigate();
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
      className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-gray-200 px-6 py-3 text-sm"
    >
      {/* Theme toggle (FR-017, US3). */}
      <button
        type="button"
        aria-pressed={isDark}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 hover:border-gray-300"
      >
        {t.preview.toolbar.themeToggle}:{' '}
        {isDark ? t.preview.toolbar.themeDark : t.preview.toolbar.themeLight}
      </button>

      {/* Font-size control (FR-018, US5). */}
      <label className="flex items-center gap-2 text-gray-700">
        {t.preview.toolbar.fontSize}
        <input
          type="range"
          min={PREVIEW_FONT_SCALE_MIN}
          max={PREVIEW_FONT_SCALE_MAX}
          step={0.1}
          value={fontScale}
          aria-label={t.preview.toolbar.fontSize}
          onChange={(e) => setFontScale(Number(e.target.value))}
        />
      </label>

      {/* Width control (FR-019, US5). */}
      <label className="flex items-center gap-2 text-gray-700">
        {t.preview.toolbar.width}
        <input
          type="range"
          min={PREVIEW_WIDTH_MIN_PX}
          max={PREVIEW_WIDTH_MAX_PX}
          step={10}
          value={widthPx}
          aria-label={t.preview.toolbar.width}
          onChange={(e) => setWidthPx(Number(e.target.value))}
        />
      </label>

      {/* Privacy toggles (FR-021, US6) — applied client-side, no re-fetch. */}
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="sr-only">{t.preview.toolbar.privacy}</legend>
        <label className="flex items-center gap-1.5 text-gray-700">
          <input
            type="checkbox"
            checked={privacy.showContactName}
            onChange={(e) => setPrivacy({ ...privacy, showContactName: e.target.checked })}
          />
          {t.preview.toolbar.showContactName}
        </label>
        <label className="flex items-center gap-1.5 text-gray-700">
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
            className="w-32 rounded-md border border-gray-200 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-1.5 text-gray-700">
          <input
            type="checkbox"
            checked={privacy.showPhoneNumber}
            onChange={(e) => setPrivacy({ ...privacy, showPhoneNumber: e.target.checked })}
          />
          {t.preview.toolbar.showPhoneNumber}
        </label>
      </fieldset>

      {/* Export settings navigation (FR-028); the chosen theme seeds the
          export default via the persisted store (US3 AC-3). */}
      <button
        type="button"
        onClick={() => navigate('/export', { state: { projectId } })}
        className="ms-auto rounded-lg border border-emerald-600 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-50"
      >
        {t.preview.toolbar.openExportSettings}
      </button>
    </div>
  );
}

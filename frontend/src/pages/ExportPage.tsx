import { useLocation, useNavigate } from 'react-router-dom';
import type { ExportHtmlRequest } from '@chatframe/shared';
import { useTranslations } from '../i18n';
import { useLanguageStore } from '../stores/useLanguageStore';
import { usePreviewSettingsStore } from '../stores/usePreviewSettingsStore';
import { useExportHtml } from '../api/export.api';
import { ExportingModal } from '../components/export/ExportingModal';

/** Fallback identifier when no import forwarded a real project (mock flow). */
const MOCK_PROJECT_ID = 'mock-project';

/**
 * Wizard step 5 — Export Settings (009 US5, FR-012/013/014).
 *
 * Privacy (name toggle, alias, phone toggle) and theme are read from and
 * written to the SAME store the preview uses, so the two screens can never
 * disagree (FR-014); the theme default is whatever the preview showed last
 * (US3 AC-3). The watermark toggle defaults to on (FR-008). "Export HTML"
 * shows the blocking "Exporting…" modal and navigates to the completion
 * screen on success; a failure shows a retryable error in the modal (FR-026).
 */
export function ExportPage() {
  const t = useTranslations();
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = (location.state as { projectId?: string } | null)?.projectId ?? MOCK_PROJECT_ID;

  const language = useLanguageStore((s) => s.language);
  const privacy = usePreviewSettingsStore((s) => s.privacy);
  const setPrivacy = usePreviewSettingsStore((s) => s.setPrivacy);
  const theme = usePreviewSettingsStore((s) => s.theme);
  const setTheme = usePreviewSettingsStore((s) => s.setTheme);
  const showWatermark = usePreviewSettingsStore((s) => s.showWatermark);
  const setShowWatermark = usePreviewSettingsStore((s) => s.setShowWatermark);

  const exportMutation = useExportHtml(projectId);

  function buildRequest(): ExportHtmlRequest {
    const alias = privacy.displayAlias?.trim();
    return {
      settings: {
        showContactName: privacy.showContactName,
        showPhoneNumber: privacy.showPhoneNumber,
        ...(alias !== undefined && alias.length > 0 ? { displayAlias: alias } : {}),
        showWatermark,
        theme,
      },
      locale: language,
    };
  }

  function startExport() {
    exportMutation.mutate(buildRequest(), {
      onSuccess: (result) => {
        navigate('/export/complete', { state: { projectId, result } });
      },
    });
  }

  const modalVisible = exportMutation.isPending || exportMutation.isError;

  return (
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">{t.export.settings.title}</h1>
      <p className="mt-2 text-gray-600">{t.export.settings.subtitle}</p>

      {/* Privacy — shared with the preview store (FR-014). */}
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-gray-900">
          {t.export.settings.privacyTitle}
        </legend>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={privacy.showContactName}
              onChange={(e) => setPrivacy({ ...privacy, showContactName: e.target.checked })}
            />
            {t.export.settings.showContactName}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            {t.export.settings.displayAlias}
            <input
              type="text"
              value={privacy.displayAlias ?? ''}
              placeholder={t.export.settings.displayAliasPlaceholder}
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
              className="w-40 rounded-md border border-gray-200 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={privacy.showPhoneNumber}
              onChange={(e) => setPrivacy({ ...privacy, showPhoneNumber: e.target.checked })}
            />
            {t.export.settings.showPhoneNumber}
          </label>
          {/* Avatars are always generated — informational, not toggleable (FR-006). */}
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{t.export.settings.fakeAvatarLabel}:</span>{' '}
            {t.export.settings.fakeAvatarNote}
          </p>
        </div>
      </fieldset>

      {/* Watermark (FR-008, default on). */}
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-gray-900">
          {t.export.settings.watermarkTitle}
        </legend>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showWatermark}
            onChange={(e) => setShowWatermark(e.target.checked)}
          />
          {t.export.settings.watermarkLabel}
        </label>
      </fieldset>

      {/* Theme — seeded from the preview (US3 AC-3). */}
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-gray-900">
          {t.export.settings.themeTitle}
        </legend>
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="export-theme"
              checked={theme === 'light'}
              onChange={() => setTheme('light')}
            />
            {t.export.settings.themeLight}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="export-theme"
              checked={theme === 'dark'}
              onChange={() => setTheme('dark')}
            />
            {t.export.settings.themeDark}
          </label>
        </div>
      </fieldset>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/preview', { state: { projectId } })}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
        >
          {t.export.settings.backToPreview}
        </button>
        <button
          type="button"
          onClick={startExport}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {t.export.settings.exportButton}
        </button>
      </div>

      {modalVisible && (
        <ExportingModal
          error={exportMutation.isError ? t.export.modal.errorBody : null}
          onRetry={startExport}
          onBack={() => navigate('/preview', { state: { projectId } })}
        />
      )}
    </section>
  );
}

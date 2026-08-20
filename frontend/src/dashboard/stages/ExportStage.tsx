import type { ExportHtmlRequest } from '@chatframe/shared';
import { useTranslations } from '../../i18n';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { usePreviewSettingsStore } from '../../stores/usePreviewSettingsStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useExportHtml } from '../../api/export.api';
import { ExportingModal } from '../../components/export/ExportingModal';
import { Button, Card, CardHeader, Checkbox, RadioGroup, TextField } from '../../components/ui';
import { StageLayout } from './StageLayout';

/**
 * Export settings stage (009 US5, FR-012/013/014). Privacy + theme are read from
 * and written to the SAME store the preview uses, so the two can never disagree.
 * "Export HTML" shows the blocking modal and, on success, advances to the
 * completion stage via {@link useWorkflowStore.finishExport}; a failure shows a
 * retryable error in the modal. Ported from the former ExportPage.
 */
export function ExportStage() {
  const t = useTranslations();
  const projectId = useWorkflowStore((s) => s.projectId) ?? '';
  const goToStage = useWorkflowStore((s) => s.goToStage);
  const finishExport = useWorkflowStore((s) => s.finishExport);

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
      onSuccess: (result) => finishExport(result),
    });
  }

  const modalVisible = exportMutation.isPending || exportMutation.isError;

  return (
    <StageLayout>
      <Card padded>
        <CardHeader title={t.export.settings.title} description={t.export.settings.subtitle} />

        {/* Privacy — shared with the preview store (FR-014). */}
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">
            {t.export.settings.privacyTitle}
          </legend>
          <div className="mt-3 flex flex-col gap-4">
            <Checkbox
              label={t.export.settings.showContactName}
              checked={privacy.showContactName}
              onChange={(e) => setPrivacy({ ...privacy, showContactName: e.target.checked })}
            />
            <TextField
              label={t.export.settings.displayAlias}
              value={privacy.displayAlias ?? ''}
              placeholder={t.export.settings.displayAliasPlaceholder}
              className="max-w-xs"
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
            />
            <Checkbox
              label={t.export.settings.showPhoneNumber}
              checked={privacy.showPhoneNumber}
              onChange={(e) => setPrivacy({ ...privacy, showPhoneNumber: e.target.checked })}
            />
            {/* Avatars are always generated — informational, not toggleable (FR-006). */}
            <p className="text-sm text-ink-muted">
              <span className="font-medium text-ink-secondary">
                {t.export.settings.fakeAvatarLabel}:
              </span>{' '}
              {t.export.settings.fakeAvatarNote}
            </p>
          </div>
        </fieldset>

        {/* Watermark (FR-008, default on). */}
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">
            {t.export.settings.watermarkTitle}
          </legend>
          <div className="mt-3">
            <Checkbox
              label={t.export.settings.watermarkLabel}
              checked={showWatermark}
              onChange={(e) => setShowWatermark(e.target.checked)}
            />
          </div>
        </fieldset>

        {/* Theme — seeded from the preview (US3 AC-3). */}
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">{t.export.settings.themeTitle}</legend>
          <div className="mt-3">
            <RadioGroup
              name="export-theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: t.export.settings.themeLight },
                { value: 'dark', label: t.export.settings.themeDark },
              ]}
            />
          </div>
        </fieldset>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="secondary" onClick={() => goToStage('preview')}>
            {t.export.settings.backToPreview}
          </Button>
          <Button variant="primary" onClick={startExport}>
            {t.export.settings.exportButton}
          </Button>
        </div>
      </Card>

      {modalVisible && (
        <ExportingModal
          error={exportMutation.isError ? t.export.modal.errorBody : null}
          onRetry={startExport}
          onBack={() => goToStage('preview')}
        />
      )}
    </StageLayout>
  );
}

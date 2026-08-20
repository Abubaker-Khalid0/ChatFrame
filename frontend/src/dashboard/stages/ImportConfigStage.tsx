import { useState } from 'react';
import { Images, MessageSquareText } from 'lucide-react';
import type { StartImportRequest } from '@chatframe/shared';
import { startImport } from '../../api/import.api';
import { useImportStore } from '../../stores/useImportStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useTranslations } from '../../i18n';
import { Button, Card, CardHeader, Checkbox } from '../../components/ui';
import { StageLayout } from './StageLayout';

/**
 * Import options (007 FR-018). The user picks what to pull from the selected
 * conversation, then starts the import. Text is always included and shown as a
 * disabled, always-on control so the scope is explicit rather than implied;
 * images are opt-in because downloading media makes the run substantially
 * longer.
 *
 * On success the workflow store carries the import/project ids plus the request
 * itself (so the progress stage can retry) and advances to `import-progress`.
 * A failed start keeps the user here with a retryable error.
 */
export function ImportConfigStage() {
  const t = useTranslations();
  const selectedChat = useWorkflowStore((s) => s.selectedChat);
  const beginImport = useWorkflowStore((s) => s.beginImport);
  const goToStage = useWorkflowStore((s) => s.goToStage);

  const [includeImages, setIncludeImages] = useState(false);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  // A stale persisted stage (or a manual rail jump) can land here without a
  // chat. Guide back instead of rendering an unusable form.
  if (selectedChat === null) {
    return (
      <StageLayout width="sm">
        <Card padded>
          <p className="text-ink-secondary">{t.import.options.noChat}</p>
          <div className="mt-6">
            <Button variant="secondary" onClick={() => goToStage('chat-picker')}>
              {t.wizard.back}
            </Button>
          </div>
        </Card>
      </StageLayout>
    );
  }

  const handleStart = async () => {
    if (starting) {
      return;
    }
    setStarting(true);
    setFailed(false);

    // `chatDisplayName` / `chatPhoneNumber` are optional in the contract, so a
    // null on the carried chat is omitted rather than sent as null
    // (exactOptionalPropertyTypes).
    const request: StartImportRequest = {
      chatId: selectedChat.id,
      ...(selectedChat.displayName !== null ? { chatDisplayName: selectedChat.displayName } : {}),
      ...(selectedChat.phoneNumber !== null ? { chatPhoneNumber: selectedChat.phoneNumber } : {}),
      options: { includeImages },
    };

    try {
      const response = await startImport(request);
      // Clear any progress/warnings left over from an earlier run before the
      // progress stage subscribes to events for this one.
      useImportStore.getState().reset();
      beginImport({
        importId: response.importId,
        projectId: response.projectId,
        request,
      });
    } catch {
      setFailed(true);
      setStarting(false);
    }
  };

  return (
    <StageLayout width="sm">
      <Card padded>
        <CardHeader title={t.import.options.title} description={t.import.options.subtitle} />

        <ul className="mt-6 flex flex-col gap-3">
          <li className="flex items-start gap-3 rounded-[var(--radius-input)] border border-line bg-surface-muted p-4">
            <Checkbox
              aria-label={t.import.options.textLabel}
              checked
              disabled
              readOnly
              className="mt-0.5"
            />
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <MessageSquareText size={16} aria-hidden="true" />
                {t.import.options.textLabel}
              </span>
              <span className="text-xs text-ink-muted">{t.import.options.textAlwaysOn}</span>
            </span>
          </li>

          <li className="flex items-start gap-3 rounded-[var(--radius-input)] border border-line p-4">
            <Checkbox
              aria-label={t.import.options.imagesLabel}
              checked={includeImages}
              onChange={(event) => setIncludeImages(event.target.checked)}
              className="mt-0.5"
            />
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Images size={16} aria-hidden="true" />
                {t.import.options.imagesLabel}
              </span>
              <span className="text-xs text-ink-muted">{t.import.options.imagesNote}</span>
            </span>
          </li>
        </ul>

        {failed && (
          <p className="mt-6 text-sm text-error" role="alert">
            {t.import.options.startError}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="secondary" onClick={() => goToStage('chat-picker')}>
            {t.wizard.back}
          </Button>
          <Button variant="primary" loading={starting} onClick={() => void handleStart()}>
            {t.import.options.start}
          </Button>
        </div>
      </Card>
    </StageLayout>
  );
}

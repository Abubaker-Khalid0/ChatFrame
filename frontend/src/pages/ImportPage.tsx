import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { StartImportRequest } from '@chatframe/shared';
import { startImport } from '../api/import.api';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { useImportStore } from '../stores/useImportStore';
import { useTranslations } from '../i18n';

/** Chat identity forwarded by the chat picker (FR-013 of 006). */
interface ImportLocationState {
  chat?: {
    id: string;
    displayName: string | null;
    phoneNumber: string | null;
  };
}

/**
 * Wizard step 2: the Import Options screen (007 FR-018). Text import is
 * always on and cannot be disabled; images are opt-in and default off, with a
 * note that importing images takes longer. Start begins the import and moves
 * to the progress screen (FR-002, FR-022).
 */
export function ImportPage() {
  const t = useTranslations();
  const navigate = useNavigate();
  const location = useLocation();
  const chat = (location.state as ImportLocationState | null)?.chat;

  const [includeImages, setIncludeImages] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const resetImport = useImportStore((s) => s.reset);

  const handleStart = async () => {
    if (chat === undefined || starting) {
      return;
    }
    setStarting(true);
    setStartFailed(false);

    const request: StartImportRequest = {
      chatId: chat.id,
      ...(chat.displayName !== null ? { chatDisplayName: chat.displayName } : {}),
      ...(chat.phoneNumber !== null ? { chatPhoneNumber: chat.phoneNumber } : {}),
      options: { includeImages },
    };

    try {
      const response = await startImport(request);
      resetImport();
      navigate('/import/progress', {
        state: { importId: response.importId, projectId: response.projectId, request },
      });
    } catch {
      setStartFailed(true);
      setStarting(false);
    }
  };

  return (
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">{t.import.options.title}</h1>
      <p className="mt-2 text-gray-600">{t.import.options.subtitle}</p>

      {chat === undefined ? (
        <div className="mt-6">
          <EmptyState
            title={t.import.options.noChat}
            actionLabel={t.wizard.back}
            onAction={() => navigate('/chat-picker')}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 opacity-75">
              <input type="checkbox" checked disabled aria-label={t.import.options.textLabel} />
              <span className="flex flex-col">
                <span className="font-medium text-gray-900">{t.import.options.textLabel}</span>
                <span className="text-sm text-gray-500">{t.import.options.textAlwaysOn}</span>
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(event) => setIncludeImages(event.target.checked)}
                aria-label={t.import.options.imagesLabel}
              />
              <span className="flex flex-col">
                <span className="font-medium text-gray-900">{t.import.options.imagesLabel}</span>
                <span className="text-sm text-gray-500">{t.import.options.imagesNote}</span>
              </span>
            </label>
          </div>

          {startFailed && (
            <div className="mt-4">
              <ErrorState title={t.import.options.startError} />
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/chat-picker')}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
            >
              {t.wizard.back}
            </button>
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={starting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {t.import.options.start}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

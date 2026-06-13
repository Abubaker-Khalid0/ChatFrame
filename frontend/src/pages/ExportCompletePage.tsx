import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExportResultSchema, type ExportResult } from '@chatframe/shared';
import { useTranslations } from '../i18n';
import { exportHtmlHref, openFolder } from '../api/export.api';
import { EmptyState } from '../components/common/EmptyState';

/**
 * Export Complete screen (009 US6, FR-015/016).
 *
 * Shows the project-relative export folder and HTML file paths from the
 * forwarded `ExportResult` and offers: "Open HTML" (the served export in a new
 * tab), "Open Folder" (OS file explorer via the backend shell endpoint —
 * hidden once the platform reports `opened: false`), and "Start New Import"
 * (back to the beginning of the wizard).
 */
export function ExportCompletePage() {
  const t = useTranslations();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { projectId?: string; result?: unknown } | null;

  const projectId = state?.projectId;
  const parsed = ExportResultSchema.safeParse(state?.result);
  const result: ExportResult | null = parsed.success ? parsed.data : null;

  const [folderSupported, setFolderSupported] = useState(true);
  const [folderError, setFolderError] = useState(false);

  // Deep-linking or a refresh loses the navigation state — guide the user
  // back instead of rendering an empty shell.
  if (projectId === undefined || result === null) {
    return (
      <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">{t.export.complete.title}</h1>
        <div className="mt-4">
          <EmptyState
            title={t.export.complete.missingResult}
            actionLabel={t.export.complete.backToExport}
            onAction={() => navigate('/export')}
          />
        </div>
      </section>
    );
  }

  async function handleOpenFolder() {
    setFolderError(false);
    try {
      const response = await openFolder(projectId as string, (result as ExportResult).exportDir);
      if (!response.opened) {
        setFolderSupported(false);
      }
    } catch {
      setFolderError(true);
    }
  }

  return (
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">{t.export.complete.title}</h1>
      <p className="mt-2 text-gray-600">{t.export.complete.subtitle}</p>

      <dl className="mt-6 flex flex-col gap-3 text-sm">
        <div>
          <dt className="font-semibold text-gray-900">{t.export.complete.folderLabel}</dt>
          <dd
            dir="ltr"
            className="mt-1 break-all rounded-md bg-gray-50 px-3 py-2 font-mono text-gray-700"
          >
            {result.exportDir}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-900">{t.export.complete.fileLabel}</dt>
          <dd
            dir="ltr"
            className="mt-1 break-all rounded-md bg-gray-50 px-3 py-2 font-mono text-gray-700"
          >
            {result.htmlFilePath}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-900">{t.export.complete.imagesLabel}</dt>
          <dd className="mt-1 text-gray-700">{result.imageCount}</dd>
        </div>
      </dl>

      {folderError && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {t.export.complete.openFolderError}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a
          href={exportHtmlHref(projectId, result.htmlFilePath)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {t.export.complete.openHtml}
        </a>
        {folderSupported && (
          <button
            type="button"
            onClick={() => void handleOpenFolder()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
          >
            {t.export.complete.openFolder}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/next')}
          className="ms-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
        >
          {t.export.complete.startNewImport}
        </button>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { CheckCircle2, ExternalLink, FolderOpen, RotateCcw } from 'lucide-react';
import { useTranslations } from '../../i18n';
import { exportHtmlHref, openFolder } from '../../api/export.api';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { EmptyState } from '../../components/common/EmptyState';
import { Button, Card, CardHeader } from '../../components/ui';
import { StageLayout } from './StageLayout';

/**
 * Export complete stage (009 US6, FR-015/016). Shows the export paths from the
 * stored {@link ExportResult} and offers Open HTML, Open Folder (hidden when the
 * platform reports unsupported), and Start New Import. Result + projectId come
 * from the workflow store. Ported from the former ExportCompletePage.
 */
export function ExportCompleteStage() {
  const t = useTranslations();
  const projectId = useWorkflowStore((s) => s.projectId);
  const result = useWorkflowStore((s) => s.exportResult);
  const goToStage = useWorkflowStore((s) => s.goToStage);
  const startNewImport = useWorkflowStore((s) => s.startNewImport);

  const [folderSupported, setFolderSupported] = useState(true);
  const [folderError, setFolderError] = useState(false);

  if (projectId === null || result === null) {
    return (
      <StageLayout width="sm">
        <Card padded>
          <h1 className="text-2xl font-bold text-ink">{t.export.complete.title}</h1>
          <div className="mt-4">
            <EmptyState
              title={t.export.complete.missingResult}
              actionLabel={t.export.complete.backToExport}
              onAction={() => goToStage('export')}
            />
          </div>
        </Card>
      </StageLayout>
    );
  }

  // Narrowed to non-null by the guard above; capture for use inside closures.
  const safeProjectId = projectId;
  const exportResult = result;

  async function handleOpenFolder() {
    setFolderError(false);
    try {
      const response = await openFolder(safeProjectId, exportResult.exportDir);
      if (!response.opened) {
        setFolderSupported(false);
      }
    } catch {
      setFolderError(true);
    }
  }

  return (
    <StageLayout width="sm">
      <Card padded>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 size={24} aria-hidden="true" />
        </span>
        <CardHeader
          className="mt-4"
          title={t.export.complete.title}
          description={t.export.complete.subtitle}
        />

        <dl className="mt-6 flex flex-col gap-3 text-sm">
          <div>
            <dt className="font-semibold text-ink">{t.export.complete.folderLabel}</dt>
            <dd
              dir="ltr"
              className="mt-1 break-all rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 font-mono text-ink-secondary"
            >
              {result.exportDir}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">{t.export.complete.fileLabel}</dt>
            <dd
              dir="ltr"
              className="mt-1 break-all rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 font-mono text-ink-secondary"
            >
              {result.htmlFilePath}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">{t.export.complete.imagesLabel}</dt>
            <dd className="mt-1 text-ink-secondary">{result.imageCount}</dd>
          </div>
        </dl>

        {folderError && (
          <p className="mt-4 text-sm text-error" role="alert">
            {t.export.complete.openFolderError}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={exportHtmlHref(projectId, result.htmlFilePath)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-input)] bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <ExternalLink size={16} aria-hidden="true" />
            {t.export.complete.openHtml}
          </a>
          {folderSupported && (
            <Button
              variant="secondary"
              leadingIcon={<FolderOpen size={16} aria-hidden="true" />}
              onClick={() => void handleOpenFolder()}
            >
              {t.export.complete.openFolder}
            </Button>
          )}
          <Button
            variant="secondary"
            className="ms-auto"
            leadingIcon={<RotateCcw size={16} aria-hidden="true" />}
            onClick={() => startNewImport()}
          >
            {t.export.complete.startNewImport}
          </Button>
        </div>
      </Card>
    </StageLayout>
  );
}

import { useMutation } from '@tanstack/react-query';
import {
  ExportResultSchema,
  ShellOpenFolderResponseSchema,
  type ExportHtmlRequest,
  type ExportResult,
  type ShellOpenFolderResponse,
} from '@chatframe/shared';
import { apiUrl, postJson } from './client';

/**
 * Export API hooks (009 contracts/export-api.md). All export operations go
 * through the backend — the frontend never touches project files
 * (FR-024, Constitution XV). Responses are validated against the shared
 * schemas at the boundary (FR-018, Constitution XIV).
 */

/**
 * Triggers the HTML export for a project. The Export Settings screen shows the
 * blocking "Exporting…" modal while this mutation is pending (FR-026) and
 * navigates to the completion screen with the validated `ExportResult`.
 */
export function useExportHtml(projectId: string) {
  return useMutation<ExportResult, Error, ExportHtmlRequest>({
    mutationFn: async (request) =>
      ExportResultSchema.parse(
        await postJson(`/api/projects/${encodeURIComponent(projectId)}/export/html`, request),
      ),
  });
}

/**
 * Builds the local backend URL that serves a file of the promoted export, so
 * "Open HTML" can open `conversation.html` in a new tab (FR-015). The backend
 * streams export files read-only from `exports/html/` with path containment;
 * `htmlFilePath` is the project-relative path from the `ExportResult`.
 */
export function exportHtmlHref(projectId: string, htmlFilePath: string): string {
  // 'exports/html/conversation.html' → the path below the export root.
  const relative = htmlFilePath.replace(/^exports\/html\//, '');
  return apiUrl(`/api/projects/${encodeURIComponent(projectId)}/export/files/${relative}`);
}

/**
 * Opens the OS file explorer at a path inside the project's `exports/`
 * directory via the backend shell endpoint (FR-016, FR-027). Resolves
 * `{ opened: false }` on unsupported platforms so the UI can hide the button.
 */
export async function openFolder(
  projectId: string,
  path: string,
): Promise<ShellOpenFolderResponse> {
  return ShellOpenFolderResponseSchema.parse(
    await postJson('/api/shell/open-folder', { projectId, path }),
  );
}

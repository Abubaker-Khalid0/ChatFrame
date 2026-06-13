import { useQuery } from '@tanstack/react-query';
import {
  PaginatedPreviewResponseSchema,
  PreviewCountResponseSchema,
  type PaginatedPreviewResponse,
  type PreviewCountResponse,
  type PrivacySettings,
} from '@chatframe/shared';
import { apiUrl, getJson } from './client';

/**
 * Preview API hooks (008 FR-025). All responses are validated against the
 * shared schemas before rendering (Constitution XIV). Pages are cached by
 * TanStack Query keyed on `[preview, projectId, offset, limit]` so returning
 * to the screen reuses already-loaded pages (FR-029, research §6).
 */

/** Default page size — inside the spec's 50–200 window (research §2). */
export const PREVIEW_PAGE_SIZE = 100;

/** Builds the privacy query-string fragment when settings are provided. */
function privacyParams(privacy?: PrivacySettings): string {
  if (privacy === undefined) {
    return '';
  }
  const params = new URLSearchParams({
    showContactName: String(privacy.showContactName),
    showPhoneNumber: String(privacy.showPhoneNumber),
  });
  if (privacy.displayAlias !== undefined && privacy.displayAlias.trim().length > 0) {
    params.set('displayAlias', privacy.displayAlias.trim());
  }
  return `&${params.toString()}`;
}

/**
 * Query options for one page of message rows `[offset, offset + limit)`.
 * Shared by {@link usePreviewPage} and the virtualizer's `useQueries` mapping
 * so cache keys never diverge (research §6). Pages of an immutable render
 * model never go stale, so re-entering the screen reuses them without a
 * re-fetch (FR-029).
 */
export function previewPageQueryOptions(
  projectId: string,
  offset: number,
  limit: number = PREVIEW_PAGE_SIZE,
  privacy?: PrivacySettings,
) {
  return {
    queryKey:
      privacy === undefined
        ? (['preview', projectId, offset, limit] as const)
        : (['preview', projectId, offset, limit, privacy] as const),
    queryFn: async (): Promise<PaginatedPreviewResponse> => {
      const data = await getJson(
        `/api/projects/${encodeURIComponent(projectId)}/preview?offset=${offset}&limit=${limit}${privacyParams(privacy)}`,
      );
      return PaginatedPreviewResponseSchema.parse(data);
    },
    staleTime: Infinity,
  };
}

/**
 * Fetches one page of message rows `[offset, offset + limit)`. Privacy is
 * normally applied client-side over cached pages (FR-021); pass `privacy`
 * only when the backend-applied variant is explicitly needed (FR-004).
 */
export function usePreviewPage(
  projectId: string,
  offset: number,
  limit: number = PREVIEW_PAGE_SIZE,
  privacy?: PrivacySettings,
) {
  return useQuery<PaginatedPreviewResponse>(
    previewPageQueryOptions(projectId, offset, limit, privacy),
  );
}

/** Fetches the total message-row count that sizes the virtual scroll area (FR-002). */
export function usePreviewCount(projectId: string) {
  return useQuery<PreviewCountResponse>({
    queryKey: ['preview-count', projectId],
    queryFn: async () => {
      const data = await getJson(`/api/projects/${encodeURIComponent(projectId)}/preview/count`);
      return PreviewCountResponseSchema.parse(data);
    },
    staleTime: Infinity,
  });
}

/** Builds the local media-stream URL for an image filename (FR-003, FR-012). */
export function mediaUrl(projectId: string, filename: string): string {
  return apiUrl(`/api/media/${encodeURIComponent(projectId)}/${encodeURIComponent(filename)}`);
}

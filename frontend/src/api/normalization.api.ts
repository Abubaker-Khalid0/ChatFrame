import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  NormalizationStatusSchema,
  NormalizeRunResponseSchema,
  QualityReportSchema,
  RenderModelSchema,
  type NormalizationStatus,
  type NormalizeRunResponse,
  type QualityReport,
  type RenderModel,
} from '@chatframe/shared';
import { getJson, postJson } from './client';

/**
 * Triggers a normalization run via `POST /api/projects/:projectId/normalize`
 * and validates the response against the shared schema (Constitution XIV). On
 * success the project's normalization status query is invalidated so polling
 * picks up the new run. All normalization logic stays on the backend — this
 * hook only kicks off and observes it (FR-016).
 */
export function useRunNormalization() {
  const queryClient = useQueryClient();
  return useMutation<NormalizeRunResponse, Error, string>({
    mutationFn: async (projectId) => {
      const data = await postJson(
        `/api/projects/${encodeURIComponent(projectId)}/normalize`,
        undefined,
      );
      return NormalizeRunResponseSchema.parse(data);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ['normalization-status', result.projectId],
      });
    },
  });
}

/** Options for {@link useNormalizationStatus}. */
export interface UseNormalizationStatusOptions {
  /** Poll interval (ms) while a run is active. Defaults to 1000ms. */
  pollIntervalMs?: number;
}

/**
 * Polls `GET /api/projects/:projectId/normalization/status` and validates the
 * response against the shared schema. Polling continues while the run is
 * `running` and stops once it settles (`completed`/`failed`/`idle`). Disabled
 * until a non-empty `projectId` is provided.
 */
export function useNormalizationStatus(
  projectId: string | undefined,
  options: UseNormalizationStatusOptions = {},
) {
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  return useQuery<NormalizationStatus>({
    queryKey: ['normalization-status', projectId],
    enabled: Boolean(projectId),
    refetchInterval: (query) => (query.state.data?.state === 'running' ? pollIntervalMs : false),
    queryFn: async () => {
      const data = await getJson(
        `/api/projects/${encodeURIComponent(projectId ?? '')}/normalization/status`,
      );
      return NormalizationStatusSchema.parse(data);
    },
  });
}

/**
 * Fetches a project's quality report via `GET .../quality-report` and validates
 * it against the shared schema (Constitution XIV). Disabled until a non-empty
 * `projectId` is provided; the report is rendered read-only by the frontend
 * (FR-016).
 */
export function useQualityReport(projectId: string | undefined) {
  return useQuery<QualityReport>({
    queryKey: ['quality-report', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const data = await getJson(
        `/api/projects/${encodeURIComponent(projectId ?? '')}/quality-report`,
      );
      return QualityReportSchema.parse(data);
    },
  });
}

/**
 * Fetches a project's render model via `GET .../render-model` and validates it
 * against the shared schema (Constitution XIV). Disabled until a non-empty
 * `projectId` is provided; the model is rendered verbatim by the preview, which
 * performs no parsing or resolution of its own (FR-016, Constitution VII).
 */
export function useRenderModel(projectId: string | undefined) {
  return useQuery<RenderModel>({
    queryKey: ['render-model', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const data = await getJson(
        `/api/projects/${encodeURIComponent(projectId ?? '')}/render-model`,
      );
      return RenderModelSchema.parse(data);
    },
  });
}

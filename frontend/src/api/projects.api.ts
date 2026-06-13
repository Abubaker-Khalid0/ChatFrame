import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateProjectResponseSchema,
  ProjectManifestResponseSchema,
  RenameProjectResponseSchema,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type ProjectManifestResponse,
  type RenameProjectResponse,
} from '@chatframe/shared';
import { getJson, patchJson, postJson } from './client';

/**
 * Creates a new project via `POST /api/projects` and validates the response
 * against the shared schema (Constitution XIV). On success, project queries are
 * invalidated so any project listing refetches.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation<CreateProjectResponse, Error, CreateProjectRequest>({
    mutationFn: async (request) => {
      const data = await postJson('/api/projects', request);
      return CreateProjectResponseSchema.parse(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Fetches a single project's manifest via `GET /api/projects/:projectId` and
 * validates the response against the shared schema (Constitution XIV). The
 * Unicode project ID is URL-encoded for the request path. Disabled until a
 * non-empty `projectId` is provided.
 */
export function useProject(projectId: string | undefined) {
  return useQuery<ProjectManifestResponse>({
    queryKey: ['projects', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const data = await getJson(`/api/projects/${encodeURIComponent(projectId ?? '')}`);
      return ProjectManifestResponseSchema.parse(data);
    },
  });
}

/** Variables for the {@link useRenameProject} mutation. */
export interface RenameProjectVariables {
  projectId: string;
  displayName: string;
}

/**
 * Renames a project's display name via `PATCH /api/projects/:projectId` and
 * validates the response against the shared schema (Constitution XIV). On
 * success, the affected project query is invalidated so it refetches.
 */
export function useRenameProject() {
  const queryClient = useQueryClient();
  return useMutation<RenameProjectResponse, Error, RenameProjectVariables>({
    mutationFn: async ({ projectId, displayName }) => {
      const data = await patchJson(`/api/projects/${encodeURIComponent(projectId)}`, {
        displayName,
      });
      return RenameProjectResponseSchema.parse(data);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['projects', result.projectId] });
    },
  });
}

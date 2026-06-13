import { z } from 'zod';

/**
 * Project lifecycle state (see data-model.md). Drives the status the UI shows
 * without having to read raw/normalized data. `cancelled` records a
 * user-cancelled import whose partial raw data is preserved (007 US4).
 */
export const ProjectStatusSchema = z.enum([
  'created',
  'importing',
  'imported',
  'error',
  'cancelled',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/**
 * `project.json` — the manifest at the root of each project folder. Describes
 * the project's identity and current state. The project ID is the folder name
 * itself and is intentionally NOT stored here (spec clarification Q1).
 */
export const ProjectManifestSchema = z.object({
  displayName: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
  chatId: z.string().min(1),
  chatDisplayName: z.string().nullable(),
  chatPhoneNumber: z.string().nullable(),
  importedAt: z.string().datetime().nullable(),
  messageCount: z.number().int().nonnegative().nullable(),
  imageCount: z.number().int().nonnegative().nullable(),
  status: ProjectStatusSchema,
});
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;

/**
 * `source.json` — records the origin of the raw data. Written once during
 * project creation and never modified (immutable, see data-model.md).
 */
export const SourceMetadataSchema = z.object({
  adapter: z.string().min(1),
  chatId: z.string().min(1),
  chatDisplayName: z.string().nullable(),
  importedAt: z.string().datetime(),
  adapterVersion: z.string().nullable(),
});
export type SourceMetadata = z.infer<typeof SourceMetadataSchema>;

/**
 * Metadata record for a downloaded image file, tracked in the
 * `normalized/media.json` index. The record persists even when the image file
 * is missing (Constitution XXIII — no silent data loss).
 */
export const MediaAssetSchema = z.object({
  mediaId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z
    .string()
    .regex(/^[a-z]+\/[a-z0-9.+-]+$/i, 'mimeType must be a valid MIME type')
    .optional(),
  sizeBytes: z.number().nonnegative().optional(),
  missing: z.boolean(),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

/**
 * A non-blocking warning returned in a successful response (e.g. a project
 * path that approaches the Windows 260-char limit, FR-021).
 */
export const PathWarningSchema = z.object({
  code: z.literal('PATH_LENGTH_WARNING'),
  message: z.string().min(1),
});
export type PathWarning = z.infer<typeof PathWarningSchema>;

/** Request body for `POST /api/projects` (see contracts/projects.md). */
export const CreateProjectRequestSchema = z.object({
  chatId: z.string().min(1),
  chatDisplayName: z.string().nullable(),
  chatPhoneNumber: z.string().nullable(),
  adapter: z.string().min(1),
  adapterVersion: z.string().nullable().optional(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

/** Response body for `POST /api/projects` (`201 Created`). */
export const CreateProjectResponseSchema = z.object({
  projectId: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: z.string().datetime(),
  status: z.literal('created'),
  warnings: z.array(PathWarningSchema),
});
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;

/**
 * Response body for `GET /api/projects/:projectId` (`200 OK`). The full
 * manifest plus the folder-name project ID.
 */
export const ProjectManifestResponseSchema = ProjectManifestSchema.extend({
  projectId: z.string().min(1),
});
export type ProjectManifestResponse = z.infer<typeof ProjectManifestResponseSchema>;

/** Request body for `PATCH /api/projects/:projectId`. */
export const RenameProjectRequestSchema = z.object({
  displayName: z.string().min(1).max(200),
});
export type RenameProjectRequest = z.infer<typeof RenameProjectRequestSchema>;

/** Response body for `PATCH /api/projects/:projectId` (`200 OK`). */
export const RenameProjectResponseSchema = z.object({
  projectId: z.string().min(1),
  displayName: z.string().min(1),
  updatedAt: z.string().datetime(),
});
export type RenameProjectResponse = z.infer<typeof RenameProjectResponseSchema>;

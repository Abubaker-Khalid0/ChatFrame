import { z } from 'zod';

/**
 * Schemas for `POST /api/shell/open-folder` (009 data-model §1.3, FR-016,
 * FR-027). The backend validates that the requested path resolves inside the
 * project's `exports/` directory before launching the OS file manager
 * (research §9, Constitution XIX).
 */

export const ShellOpenFolderRequestSchema = z.object({
  /** Project whose `exports/` directory bounds the allowed path. */
  projectId: z.string().min(1),
  /** Project-relative or absolute path to open; containment-checked server-side. */
  path: z.string().min(1),
});
export type ShellOpenFolderRequest = z.infer<typeof ShellOpenFolderRequestSchema>;

export const ShellOpenFolderResponseSchema = z.object({
  /** True when a file manager was launched; false on unsupported platforms. */
  opened: z.boolean(),
});
export type ShellOpenFolderResponse = z.infer<typeof ShellOpenFolderResponseSchema>;

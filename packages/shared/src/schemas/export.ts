import { z } from 'zod';

/** Visual theme for an export (see data-model.md). */
export const ExportThemeSchema = z.enum(['light', 'dark']);
export type ExportTheme = z.infer<typeof ExportThemeSchema>;

/**
 * User privacy and presentation choices for an export
 * (Constitution XII — privacy controls before export). Defaults match the
 * documented data model: contact name shown, phone number hidden, watermark
 * on, light theme.
 */
export const ExportSettingsSchema = z.object({
  showContactName: z.boolean().default(true),
  showPhoneNumber: z.boolean().default(false),
  displayAlias: z.string().optional(),
  showWatermark: z.boolean().default(true),
  theme: ExportThemeSchema.default('light'),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;

/**
 * Request body for `POST /api/projects/:projectId/export/html`
 * (009 data-model §1.2, research §5). Wraps the unchanged `ExportSettings`
 * with the UI locale, used only to localize the hidden-name placeholder and
 * standalone chrome — message content is never translated.
 */
export const ExportHtmlRequestSchema = z.object({
  settings: ExportSettingsSchema,
  locale: z.enum(['en', 'ar']).default('en'),
});
export type ExportHtmlRequest = z.infer<typeof ExportHtmlRequestSchema>;

/**
 * Successful export metadata returned by the export endpoint
 * (009 data-model §1.1). Paths are project-relative — the absolute filesystem
 * layout is never leaked to the UI (Constitution XIX).
 */
export const ExportResultSchema = z.object({
  projectId: z.string().min(1),
  exportDir: z.string().min(1),
  htmlFilePath: z.string().min(1),
  imageCount: z.number().int().nonnegative(),
  totalAssetSize: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type ExportResult = z.infer<typeof ExportResultSchema>;

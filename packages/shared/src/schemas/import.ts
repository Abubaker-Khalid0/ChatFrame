import { z } from 'zod';

/** Pipeline stages for an ongoing import operation (see data-model.md). */
export const ImportStageSchema = z.enum([
  'preparing_project',
  'fetching_metadata',
  'fetching_messages',
  'saving_raw_messages',
  'downloading_images',
  'normalizing',
  'resolving_replies',
  'generating_quality_report',
  'preparing_preview',
  'completed',
  'failed',
  'cancelled',
]);
export type ImportStage = z.infer<typeof ImportStageSchema>;

/** Real-time status indicator for an ongoing import operation. */
export const ImportProgressSchema = z.object({
  importId: z.string().min(1),
  projectId: z.string().min(1),
  stage: ImportStageSchema,
  messagesImported: z.number().int().nonnegative(),
  messagesTotal: z.number().int().positive().optional(),
  imagesDownloaded: z.number().int().nonnegative(),
  imagesTotal: z.number().int().positive().optional(),
  warnings: z.array(z.string()),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type ImportProgress = z.infer<typeof ImportProgressSchema>;

/**
 * User's choice on the Import Options screen (data-model §3). Text import is
 * implicit and always on — there is no `includeText` flag (FR-018).
 */
export const ImportOptionsSchema = z.object({
  includeImages: z.boolean().default(false),
});
export type ImportOptions = z.infer<typeof ImportOptionsSchema>;

/** Request body for `POST /api/import/start` (FR-013, FR-025; data-model §4). */
export const StartImportRequestSchema = z.object({
  chatId: z.string().min(1),
  chatDisplayName: z.string().optional(),
  chatPhoneNumber: z.string().optional(),
  options: ImportOptionsSchema,
});
export type StartImportRequest = z.infer<typeof StartImportRequestSchema>;

/** Response body for `POST /api/import/start` (`202 Accepted`). */
export const StartImportResponseSchema = z.object({
  importId: z.string().min(1),
  projectId: z.string().min(1),
  stage: ImportStageSchema,
  startedAt: z.string().datetime(),
});
export type StartImportResponse = z.infer<typeof StartImportResponseSchema>;

/**
 * Response body for `POST /api/import/:importId/cancel` (FR-015; data-model §5).
 * `cancellationRequested` is `false` when the request was ignored because the
 * import was in a non-cancellable or terminal stage (US4 AC-5).
 */
export const CancelImportResponseSchema = z.object({
  importId: z.string().min(1),
  stage: ImportStageSchema,
  cancellationRequested: z.boolean(),
});
export type CancelImportResponse = z.infer<typeof CancelImportResponseSchema>;

/**
 * Import SSE event payloads (FR-016; data-model §6, contracts/import-api.md).
 * `import.progress` and `import.completed` carry a full `ImportProgress`
 * snapshot; warnings and errors are structured and user-safe (no secrets,
 * stack traces, or message content — US5 AC-3).
 */
export const SseImportProgressEventSchema = ImportProgressSchema;
export type SseImportProgressEvent = z.infer<typeof SseImportProgressEventSchema>;

/** Non-fatal issue; the import continues (FR-012, FR-016). */
export const SseImportWarningEventSchema = z.object({
  importId: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
  messageId: z.string().optional(),
});
export type SseImportWarningEvent = z.infer<typeof SseImportWarningEventSchema>;

/** Fatal error; the import transitions to `failed` (US5). */
export const SseImportErrorEventSchema = z.object({
  importId: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
});
export type SseImportErrorEvent = z.infer<typeof SseImportErrorEventSchema>;

/** Terminal snapshot; `stage` ∈ { completed, failed, cancelled }. */
export const SseImportCompletedEventSchema = ImportProgressSchema;
export type SseImportCompletedEvent = z.infer<typeof SseImportCompletedEventSchema>;

import { z } from 'zod';

/** A non-fatal issue surfaced during import/normalization (data-model.md). */
export const QualityWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  messageId: z.string().optional(),
  count: z.number().int().nonnegative().optional(),
});
export type QualityWarning = z.infer<typeof QualityWarningSchema>;

/** A fatal or critical issue surfaced during import/normalization. */
export const QualityErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  fatal: z.boolean(),
});
export type QualityError = z.infer<typeof QualityErrorSchema>;

/**
 * Summary of data accuracy produced after import/normalization
 * (Constitution VIII — quality reporting is mandatory).
 */
export const QualityReportSchema = z.object({
  projectId: z.string().min(1),
  generatedAt: z.string().datetime(),
  totalRawMessages: z.number().int().nonnegative(),
  totalNormalizedMessages: z.number().int().nonnegative(),
  duplicatesRemoved: z.number().int().nonnegative(),
  unresolvedReplies: z.number().int().nonnegative(),
  missingImages: z.number().int().nonnegative(),
  unsupportedMessageTypes: z.record(z.string(), z.number().int().nonnegative()),
  dateRange: z.object({
    from: z.string().datetime().nullable(),
    to: z.string().datetime().nullable(),
  }),
  warnings: z.array(QualityWarningSchema),
  errors: z.array(QualityErrorSchema),
});
export type QualityReport = z.infer<typeof QualityReportSchema>;

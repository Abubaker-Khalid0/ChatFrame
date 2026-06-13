import { QualityReportSchema, type QualityReport } from '@chatframe/shared';
import type { NormalizationMetrics } from './types';

/**
 * Quality report assembly (FR-010, Constitution VIII).
 *
 * Serializes the pipeline's metrics accumulator into a schema-valid
 * {@link QualityReport}. When zero messages remain after normalization, a fatal
 * `QualityError` is added so the report clearly signals that the import cannot
 * proceed to export (US4 AC4, edge case). The builder is pure — it does not
 * mutate the accumulator — and validates its output against the shared schema.
 */

export interface BuildQualityReportOptions {
  projectId: string;
  /** Clock injection for a deterministic `generatedAt` in tests. */
  now?: () => Date;
}

/** Code used for the "no messages remained" fatal error. */
export const NO_MESSAGES_ERROR_CODE = 'NO_MESSAGES';

/** Builds and validates the quality report from accumulated metrics. */
export function buildQualityReport(
  metrics: NormalizationMetrics,
  options: BuildQualityReportOptions,
): QualityReport {
  const now = options.now ?? (() => new Date());

  const errors = [...metrics.errors];
  if (metrics.totalNormalizedMessages === 0) {
    errors.push({
      code: NO_MESSAGES_ERROR_CODE,
      message: 'No messages remained after normalization; the import cannot proceed to export.',
      fatal: true,
    });
  }

  const report: QualityReport = {
    projectId: options.projectId,
    generatedAt: now().toISOString(),
    totalRawMessages: metrics.totalRawMessages,
    totalNormalizedMessages: metrics.totalNormalizedMessages,
    duplicatesRemoved: metrics.duplicatesRemoved,
    unresolvedReplies: metrics.unresolvedReplies,
    missingImages: metrics.missingImages,
    unsupportedMessageTypes: { ...metrics.unsupportedMessageTypes },
    dateRange: { from: metrics.dateFrom, to: metrics.dateTo },
    warnings: [...metrics.warnings],
    errors,
  };

  // Validate at the boundary (FR-010, Constitution XIV).
  return QualityReportSchema.parse(report);
}

/** True when a report carries a fatal error (blocks export, FR-018). */
export function hasFatalError(report: QualityReport): boolean {
  return report.errors.some((error) => error.fatal);
}

import type { QualityReport } from '@chatframe/shared';

/**
 * Pure view logic for the Quality Report screen (US8). Kept separate from the
 * React component so the gating rules are unit-testable without a DOM renderer.
 * The frontend only reads the report — it performs no normalization (FR-016).
 */

/** True when the report carries a fatal error (blocks export, FR-018). */
export function reportHasFatalError(report: QualityReport): boolean {
  return report.errors.some((error) => error.fatal);
}

/**
 * Whether the user may proceed to the preview. A loaded report with a fatal
 * error blocks progression (US8 AC2). When no report is loaded (still loading
 * or unavailable), progression is not blocked by this gate.
 */
export function canContinueToPreview(report: QualityReport | undefined): boolean {
  return report ? !reportHasFatalError(report) : true;
}

/** Total count of unsupported messages across all original types. */
export function unsupportedTotal(report: QualityReport): number {
  return Object.values(report.unsupportedMessageTypes).reduce((sum, count) => sum + count, 0);
}

/** Whether the missing-image notice should be shown (US8 AC3). */
export function shouldShowMissingImageNotice(report: QualityReport): boolean {
  return report.missingImages > 0;
}

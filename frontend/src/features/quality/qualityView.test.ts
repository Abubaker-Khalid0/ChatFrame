import { describe, expect, it } from 'vitest';
import type { QualityReport } from '@chatframe/shared';
import {
  canContinueToPreview,
  reportHasFatalError,
  shouldShowMissingImageNotice,
  unsupportedTotal,
} from './qualityView';

function report(overrides: Partial<QualityReport> = {}): QualityReport {
  return {
    projectId: 'p1',
    generatedAt: '2026-06-10T16:40:07.000Z',
    totalRawMessages: 10,
    totalNormalizedMessages: 10,
    duplicatesRemoved: 0,
    unresolvedReplies: 0,
    missingImages: 0,
    unsupportedMessageTypes: {},
    dateRange: { from: '2026-06-07T09:00:00.000Z', to: '2026-06-09T21:00:00.000Z' },
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe('qualityView gating (US8)', () => {
  it('allows continue for a warnings-only report (AC1)', () => {
    const r = report({ warnings: [{ code: 'FUTURE_TIMESTAMP', message: 'future', count: 1 }] });
    expect(reportHasFatalError(r)).toBe(false);
    expect(canContinueToPreview(r)).toBe(true);
  });

  it('blocks continue for a fatal-error report (AC2)', () => {
    const r = report({
      totalNormalizedMessages: 0,
      errors: [{ code: 'NO_MESSAGES', message: 'none', fatal: true }],
    });
    expect(reportHasFatalError(r)).toBe(true);
    expect(canContinueToPreview(r)).toBe(false);
  });

  it('does not block continue on a non-fatal error', () => {
    const r = report({ errors: [{ code: 'MINOR', message: 'x', fatal: false }] });
    expect(canContinueToPreview(r)).toBe(true);
  });

  it('shows the missing-image notice only when images are missing (AC3)', () => {
    expect(shouldShowMissingImageNotice(report({ missingImages: 0 }))).toBe(false);
    expect(shouldShowMissingImageNotice(report({ missingImages: 3 }))).toBe(true);
  });

  it('sums unsupported message types', () => {
    expect(unsupportedTotal(report({ unsupportedMessageTypes: { audio: 2, sticker: 1 } }))).toBe(3);
    expect(unsupportedTotal(report())).toBe(0);
  });

  it('allows continue when no report is loaded (mock/loading state)', () => {
    expect(canContinueToPreview(undefined)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { QualityReportSchema } from '@chatframe/shared';
import { buildQualityReport, hasFatalError } from './QualityReportBuilder';
import { createMetrics, type NormalizationMetrics } from './types';

const NOW = (): Date => new Date('2026-06-10T16:40:07.000Z');

function metricsWith(overrides: Partial<NormalizationMetrics>): NormalizationMetrics {
  return { ...createMetrics(), ...overrides };
}

describe('QualityReportBuilder (FR-010, SC-006)', () => {
  it('serializes all counts and date range into a schema-valid report', () => {
    const metrics = metricsWith({
      totalRawMessages: 13,
      totalNormalizedMessages: 10,
      duplicatesRemoved: 1,
      unresolvedReplies: 2,
      missingImages: 1,
      unsupportedMessageTypes: { audio: 1, sticker: 2 },
      dateFrom: '2026-01-02T08:11:00.000Z',
      dateTo: '2026-06-09T21:55:00.000Z',
    });

    const report = buildQualityReport(metrics, { projectId: 'proj-1', now: NOW });

    expect(() => QualityReportSchema.parse(report)).not.toThrow();
    expect(report).toMatchObject({
      projectId: 'proj-1',
      generatedAt: '2026-06-10T16:40:07.000Z',
      totalRawMessages: 13,
      totalNormalizedMessages: 10,
      duplicatesRemoved: 1,
      unresolvedReplies: 2,
      missingImages: 1,
      unsupportedMessageTypes: { audio: 1, sticker: 2 },
      dateRange: { from: '2026-01-02T08:11:00.000Z', to: '2026-06-09T21:55:00.000Z' },
    });
  });

  it('has empty warnings and errors on clean input', () => {
    const report = buildQualityReport(metricsWith({ totalNormalizedMessages: 5 }), {
      projectId: 'p',
      now: NOW,
    });
    expect(report.warnings).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(hasFatalError(report)).toBe(false);
  });

  it('passes non-fatal warnings through unchanged', () => {
    const metrics = metricsWith({
      totalNormalizedMessages: 3,
      warnings: [{ code: 'FUTURE_TIMESTAMP', message: 'in the future', count: 1 }],
    });
    const report = buildQualityReport(metrics, { projectId: 'p', now: NOW });
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]?.code).toBe('FUTURE_TIMESTAMP');
    expect(hasFatalError(report)).toBe(false);
  });

  it('adds a fatal error when zero messages remain', () => {
    const report = buildQualityReport(
      metricsWith({ totalRawMessages: 2, totalNormalizedMessages: 0 }),
      { projectId: 'p', now: NOW },
    );
    expect(hasFatalError(report)).toBe(true);
    expect(report.errors.some((e) => e.code === 'NO_MESSAGES' && e.fatal)).toBe(true);
  });

  it('represents a null date range when there are no messages', () => {
    const report = buildQualityReport(metricsWith({}), { projectId: 'p', now: NOW });
    expect(report.dateRange).toEqual({ from: null, to: null });
  });

  it('does not mutate the source metrics', () => {
    const metrics = metricsWith({ totalNormalizedMessages: 0 });
    buildQualityReport(metrics, { projectId: 'p', now: NOW });
    expect(metrics.errors).toEqual([]);
  });
});

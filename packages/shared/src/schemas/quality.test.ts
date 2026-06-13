import { describe, expect, it } from 'vitest';
import { QualityReportSchema } from './quality';

const validReport = {
  projectId: 'mock-project',
  generatedAt: '2026-06-09T15:00:00.000Z',
  totalRawMessages: 55,
  totalNormalizedMessages: 51,
  duplicatesRemoved: 4,
  unresolvedReplies: 1,
  missingImages: 1,
  unsupportedMessageTypes: { location: 1, sticker: 1 },
  dateRange: { from: '2026-06-07T08:30:00.000Z', to: '2026-06-09T14:32:00.000Z' },
  warnings: [],
  errors: [],
};

describe('QualityReportSchema', () => {
  it('accepts a valid report', () => {
    expect(QualityReportSchema.safeParse(validReport).success).toBe(true);
  });

  it('accepts a null dateRange bound', () => {
    const result = QualityReportSchema.safeParse({
      ...validReport,
      dateRange: { from: null, to: null },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative count and reports the path', () => {
    const result = QualityReportSchema.safeParse({ ...validReport, missingImages: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'missingImages')).toBe(
        true,
      );
    }
  });

  it('rejects when dateRange is missing', () => {
    const { dateRange: _omitted, ...withoutRange } = validReport;
    expect(QualityReportSchema.safeParse(withoutRange).success).toBe(false);
  });

  it('rejects a warning that is missing a code', () => {
    const result = QualityReportSchema.safeParse({
      ...validReport,
      warnings: [{ message: 'no code here' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'warnings.0.code')).toBe(
        true,
      );
    }
  });
});

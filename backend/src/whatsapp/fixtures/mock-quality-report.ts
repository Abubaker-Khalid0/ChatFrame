import type { QualityReport } from '@chatframe/shared';

/**
 * A synthetic quality report whose metrics are consistent with the mock
 * conversation: 1 unresolved reply (msg-031), 1 missing image (msg-024), and
 * two unsupported types (location, sticker). Conforms to `QualityReportSchema`
 * (Constitution VIII).
 */
export const mockQualityReport: QualityReport = {
  projectId: 'mock-project',
  generatedAt: '2026-06-09T15:00:00.000Z',
  totalRawMessages: 55,
  totalNormalizedMessages: 51,
  duplicatesRemoved: 4,
  unresolvedReplies: 1,
  missingImages: 1,
  unsupportedMessageTypes: {
    location: 1,
    sticker: 1,
  },
  dateRange: {
    from: '2026-06-07T08:30:00.000Z',
    to: '2026-06-09T14:32:00.000Z',
  },
  warnings: [
    {
      code: 'UNRESOLVED_REPLY',
      message: 'A reply referenced a message that is not present in the export window.',
      messageId: 'msg-031',
      count: 1,
    },
    {
      code: 'MISSING_IMAGE',
      message: 'An image could not be downloaded and is shown as a placeholder.',
      messageId: 'msg-024',
      count: 1,
    },
    {
      code: 'UNSUPPORTED_TYPE',
      message: 'Some messages use types that are not rendered in this version.',
      count: 2,
    },
  ],
  errors: [],
};

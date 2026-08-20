import type { NormalizedMessage, QualityError, QualityWarning } from '@chatframe/shared';

/**
 * Backend-internal types for the normalization pipeline. These are NOT shared
 * with the frontend — they are intermediate working shapes threaded between
 * stages. The serialized outputs use the shared schemas (`NormalizedMessage`,
 * `QualityReport`, `Participant`, `RenderModel`).
 */

/**
 * A mapped message paired with the data later stages need: its original raw
 * type (for unsupported classification) and its index in the raw file (for a
 * stable sort tie-break, research §10).
 */
export interface MappedMessage {
  message: NormalizedMessage;
  /** The raw, unclassified source type string. */
  rawType: string;
  /** Zero-based position of the source record in the raw file. */
  fileIndex: number;
  /** Source media reference for image messages (consumed by linkImages, US7). */
  rawMediaId?: string;
  /** Source caption for media messages (consumed by linkImages, US7). */
  rawCaption?: string;
  /**
   * Real sender phone digits resolved from the source contact, threaded to
   * participant resolution so the conversation header can show the actual
   * number instead of one parsed from an opaque id (e.g. WhatsApp `@lid`).
   */
  senderPhoneNumber?: string;
}

/**
 * Mutable accumulator threaded through the pipeline. Each stage contributes its
 * counts/warnings; `QualityReportBuilder` (US4) serializes it. Counts owned by
 * later stages stay at their defaults until those stages are wired.
 */
export interface NormalizationMetrics {
  totalRawMessages: number;
  totalNormalizedMessages: number;
  duplicatesRemoved: number;
  unresolvedReplies: number;
  missingImages: number;
  unsupportedMessageTypes: Record<string, number>;
  dateFrom: string | null;
  dateTo: string | null;
  warnings: QualityWarning[];
  errors: QualityError[];
}

/** Creates a zeroed metrics accumulator. */
export function createMetrics(): NormalizationMetrics {
  return {
    totalRawMessages: 0,
    totalNormalizedMessages: 0,
    duplicatesRemoved: 0,
    unresolvedReplies: 0,
    missingImages: 0,
    unsupportedMessageTypes: {},
    dateFrom: null,
    dateTo: null,
    warnings: [],
    errors: [],
  };
}

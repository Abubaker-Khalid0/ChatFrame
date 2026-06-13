import type { QualityWarning } from '@chatframe/shared';

/**
 * Timestamp normalization (FR-003, research §3).
 *
 * Source timestamps are Unix **seconds**. This stage derives a UTC ISO-8601
 * `timestampIso` and a `YYYY-MM-DD` `dateKey`, preserving the original value in
 * `timestampOriginal`. UTC is used so `dateKey` grouping is reproducible across
 * machines (determinism, SC-003).
 *
 * Edge cases (spec):
 * - Missing/invalid timestamp → a synthetic value derived from file position
 *   (the caller supplies `fallbackMs`), plus a `MISSING_TIMESTAMP` warning.
 * - Future timestamp → preserved as-is, plus a `FUTURE_TIMESTAMP` warning.
 */

/** Maximum absolute epoch-ms representable by a JS `Date` (ECMAScript spec). */
const MAX_TIME_MS = 8.64e15;

export interface NormalizeTimestampInput {
  /** Raw source timestamp in Unix seconds (may be absent). */
  timestamp?: number;
  /** Synthetic fallback epoch-ms when the timestamp is missing/invalid. */
  fallbackMs: number;
  /** "Now" epoch-ms used to detect future timestamps. */
  nowMs: number;
}

export interface NormalizedTimestamp {
  timestampOriginal?: string;
  timestampIso: string;
  dateKey: string;
  /** Epoch-ms actually used (for the caller to chain as the next fallback). */
  epochMs: number;
  warnings: QualityWarning[];
}

function isValidEpochMs(ms: number): boolean {
  return Number.isFinite(ms) && Math.abs(ms) <= MAX_TIME_MS;
}

/** Normalizes a single raw timestamp into ISO + dateKey with warnings. */
export function normalizeTimestamp(input: NormalizeTimestampInput): NormalizedTimestamp {
  const { timestamp, fallbackMs, nowMs } = input;
  const warnings: QualityWarning[] = [];

  let epochMs: number;
  let timestampOriginal: string | undefined;

  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    const candidate = Math.trunc(timestamp * 1000);
    if (isValidEpochMs(candidate)) {
      epochMs = candidate;
      timestampOriginal = String(timestamp);
      if (candidate > nowMs) {
        warnings.push({
          code: 'FUTURE_TIMESTAMP',
          message: 'Message timestamp is in the future; preserved as-is.',
        });
      }
    } else {
      epochMs = fallbackMs;
      warnings.push({
        code: 'MISSING_TIMESTAMP',
        message: 'Message timestamp is out of range; a synthetic timestamp was assigned.',
      });
    }
  } else {
    epochMs = fallbackMs;
    warnings.push({
      code: 'MISSING_TIMESTAMP',
      message: 'Message has no timestamp; a synthetic timestamp was assigned.',
    });
  }

  const iso = new Date(epochMs).toISOString();
  return {
    ...(timestampOriginal !== undefined ? { timestampOriginal } : {}),
    timestampIso: iso,
    dateKey: iso.slice(0, 10),
    epochMs,
    warnings,
  };
}

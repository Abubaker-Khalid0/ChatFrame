import type { QualityWarning } from '@chatframe/shared';

/**
 * Timestamp normalization (FR-003, research §3).
 *
 * Source timestamps are expected in Unix **seconds**. This stage derives a UTC
 * ISO-8601 `timestampIso` and a `YYYY-MM-DD` `dateKey`, preserving the original
 * value in `timestampOriginal`. UTC is used so `dateKey` grouping is
 * reproducible across machines (determinism, SC-003).
 *
 * Robustness (Phase 10 hardening):
 * - Auto-detection of millisecond timestamps: some adapters or export tools
 *   accidentally pass milliseconds instead of seconds. Values above a
 *   heuristic threshold (year 2200 in seconds ≈ 7.3e9) are interpreted as
 *   milliseconds and divided by 1000, with a corrective warning.
 * - Negative timestamps (before Unix epoch) are treated as invalid and fall
 *   back to synthetic — WhatsApp messages cannot predate 2009.
 * - NaN, Infinity, and non-finite values are explicitly handled.
 *
 * Edge cases (spec):
 * - Missing/invalid timestamp → a synthetic value derived from file position
 *   (the caller supplies `fallbackMs`), plus a `MISSING_TIMESTAMP` warning.
 * - Future timestamp → preserved as-is, plus a `FUTURE_TIMESTAMP` warning.
 */

/** Maximum absolute epoch-ms representable by a JS `Date` (ECMAScript spec). */
const MAX_TIME_MS = 8.64e15;

/**
 * If a "seconds" timestamp exceeds this threshold, it's almost certainly
 * milliseconds. This corresponds to approximately year 2200 in seconds, which
 * is far enough in the future to never be a real seconds timestamp from
 * WhatsApp (launched 2009, messages span 2009–present).
 */
const MILLIS_HEURISTIC_THRESHOLD = 7_300_000_000;

/**
 * Earliest plausible WhatsApp timestamp in seconds (2009-01-01 00:00:00 UTC).
 * WhatsApp was founded in 2009; no message can legitimately predate this.
 */
const EARLIEST_PLAUSIBLE_SECONDS = 1_230_768_000;

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
    // Reject negative timestamps — WhatsApp cannot have pre-epoch messages.
    if (timestamp < 0) {
      epochMs = fallbackMs;
      warnings.push({
        code: 'MISSING_TIMESTAMP',
        message: 'Message timestamp is negative (pre-epoch); a synthetic timestamp was assigned.',
      });
    } else {
      let seconds = timestamp;

      // Auto-detect millisecond timestamps: if the value exceeds the
      // heuristic threshold it's almost certainly in milliseconds.
      if (seconds > MILLIS_HEURISTIC_THRESHOLD) {
        seconds = Math.trunc(seconds / 1000);
        warnings.push({
          code: 'TIMESTAMP_CORRECTED',
          message:
            'Message timestamp appears to be in milliseconds; corrected to seconds.',
        });
      }

      // Reject implausibly old timestamps (before WhatsApp existed).
      if (seconds > 0 && seconds < EARLIEST_PLAUSIBLE_SECONDS) {
        epochMs = fallbackMs;
        warnings.push({
          code: 'MISSING_TIMESTAMP',
          message:
            'Message timestamp predates WhatsApp (before 2009); a synthetic timestamp was assigned.',
        });
      } else {
        const candidate = Math.trunc(seconds * 1000);
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
      }
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

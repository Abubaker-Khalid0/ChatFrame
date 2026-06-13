import { describe, expect, it } from 'vitest';
import { normalizeTimestamp } from './normalizeTimestamp';

const NOW_MS = Date.UTC(2026, 5, 10, 12, 0, 0); // 2026-06-10T12:00:00Z
const FALLBACK_MS = Date.UTC(2026, 0, 1, 0, 0, 0); // 2026-01-01T00:00:00Z

describe('normalizeTimestamp (FR-003)', () => {
  it('derives UTC ISO and YYYY-MM-DD dateKey from Unix seconds', () => {
    const seconds = Math.trunc(Date.UTC(2026, 5, 7, 9, 30, 0) / 1000);
    const result = normalizeTimestamp({
      timestamp: seconds,
      fallbackMs: FALLBACK_MS,
      nowMs: NOW_MS,
    });

    expect(result.timestampIso).toBe('2026-06-07T09:30:00.000Z');
    expect(result.dateKey).toBe('2026-06-07');
    expect(result.timestampOriginal).toBe(String(seconds));
    expect(result.warnings).toHaveLength(0);
  });

  it('assigns a synthetic timestamp and warns when the timestamp is missing', () => {
    const result = normalizeTimestamp({ fallbackMs: FALLBACK_MS, nowMs: NOW_MS });

    expect(result.epochMs).toBe(FALLBACK_MS);
    expect(result.timestampOriginal).toBeUndefined();
    expect(result.timestampIso).toBe('2026-01-01T00:00:00.000Z');
    expect(result.warnings.map((w) => w.code)).toEqual(['MISSING_TIMESTAMP']);
  });

  it('preserves a future timestamp and warns', () => {
    const futureSeconds = Math.trunc(Date.UTC(2030, 0, 1, 0, 0, 0) / 1000);
    const result = normalizeTimestamp({
      timestamp: futureSeconds,
      fallbackMs: FALLBACK_MS,
      nowMs: NOW_MS,
    });

    expect(result.timestampIso).toBe('2030-01-01T00:00:00.000Z');
    expect(result.warnings.map((w) => w.code)).toEqual(['FUTURE_TIMESTAMP']);
  });

  it('falls back and warns for an out-of-range timestamp', () => {
    const result = normalizeTimestamp({
      timestamp: Number.MAX_SAFE_INTEGER,
      fallbackMs: FALLBACK_MS,
      nowMs: NOW_MS,
    });

    expect(result.epochMs).toBe(FALLBACK_MS);
    expect(result.warnings.map((w) => w.code)).toEqual(['MISSING_TIMESTAMP']);
  });
});

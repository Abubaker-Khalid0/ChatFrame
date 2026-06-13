import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

// All reference dates are built in local time so calendar-day bucketing is
// timezone-safe regardless of where the test runs.
const NOW = new Date(2026, 5, 11, 12, 0, 0);

describe('formatRelativeTime (FR-008)', () => {
  it('shows the time of day for a message from today', () => {
    const today = new Date(2026, 5, 11, 9, 30, 0);
    const formatted = formatRelativeTime(today.toISOString(), 'en-US', NOW);
    const expected = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(today);
    expect(formatted).toBe(expected);
  });

  it('shows a localized "yesterday" for a message from yesterday (LTR)', () => {
    const yesterday = new Date(2026, 5, 10, 22, 0, 0);
    expect(formatRelativeTime(yesterday.toISOString(), 'en-US', NOW)).toBe('yesterday');
  });

  it('shows a localized "yesterday" in Arabic (RTL)', () => {
    const yesterday = new Date(2026, 5, 10, 22, 0, 0);
    const expected = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' }).format(-1, 'day');
    expect(formatRelativeTime(yesterday.toISOString(), 'ar', NOW)).toBe(expected);
  });

  it('shows a month/day date for an older same-year message', () => {
    const older = new Date(2026, 2, 3, 10, 0, 0);
    const expected = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(older);
    expect(formatRelativeTime(older.toISOString(), 'en-US', NOW)).toBe(expected);
  });

  it('includes the year for a message from a previous year', () => {
    const lastYear = new Date(2025, 10, 20, 10, 0, 0);
    const expected = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(lastYear);
    expect(formatRelativeTime(lastYear.toISOString(), 'en-US', NOW)).toBe(expected);
  });

  it('formats older dates with Arabic locale digits and month names (RTL)', () => {
    const older = new Date(2026, 2, 3, 10, 0, 0);
    const expected = new Intl.DateTimeFormat('ar', {
      month: 'short',
      day: 'numeric',
    }).format(older);
    expect(formatRelativeTime(older.toISOString(), 'ar', NOW)).toBe(expected);
  });

  it('treats late last night vs early this morning as different buckets', () => {
    const justBeforeMidnight = new Date(2026, 5, 10, 23, 59, 0);
    expect(formatRelativeTime(justBeforeMidnight.toISOString(), 'en-US', NOW)).toBe('yesterday');
  });
});

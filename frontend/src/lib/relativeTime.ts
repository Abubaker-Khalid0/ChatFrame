/**
 * Relative timestamp formatter for the chat list (FR-008): time of day for
 * today, a localized "yesterday", and a short date for anything older — all
 * via `Intl` so Arabic and English render correctly (Constitution XVI).
 */

/** True when both dates fall on the same local calendar day. */
function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Formats an ISO timestamp relative to `now` (injectable for tests):
 * today → localized time, yesterday → localized "yesterday", older → short
 * date (with the year only when it differs from the current year).
 */
export function formatRelativeTime(iso: string, locale: string, now: Date = new Date()): string {
  const date = new Date(iso);

  if (sameCalendarDay(date, now)) {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameCalendarDay(date, yesterday)) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day');
  }

  return new Intl.DateTimeFormat(locale, {
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }),
    month: 'short',
    day: 'numeric',
  }).format(date);
}

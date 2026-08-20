/** Minimal className joiner: drops falsy values and joins with spaces. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ');
}

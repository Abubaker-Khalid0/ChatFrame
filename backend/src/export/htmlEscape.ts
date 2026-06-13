/**
 * Strict HTML escaping for the export renderer (009 research §3).
 *
 * Message content is untrusted third-party text and the exported file is
 * opened directly in a browser, so every dynamic value — bodies, captions,
 * names, aliases, phone numbers, reply previews, unsupported type/reason —
 * MUST pass through one of these functions. Escaping is centralized here so
 * it cannot be forgotten per call site. Newlines are preserved verbatim and
 * rendered via `white-space: pre-wrap` (no `<br>` injection).
 */

const TEXT_REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

const ATTR_REPLACEMENTS: Record<string, string> = {
  ...TEXT_REPLACEMENTS,
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes a value for HTML text content (`& < >`). */
export function escapeText(value: string): string {
  return value.replace(/[&<>]/g, (ch) => TEXT_REPLACEMENTS[ch] ?? ch);
}

/** Escapes a value for an HTML attribute (`& < > " '`). */
export function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ATTR_REPLACEMENTS[ch] ?? ch);
}

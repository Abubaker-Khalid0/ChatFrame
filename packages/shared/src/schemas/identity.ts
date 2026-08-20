/**
 * WhatsApp identity presentation — the single source of truth shared by the
 * backend normalization pipeline, the live preview, and the static HTML export
 * (Constitution IV/XII). Centralizing it here guarantees the chat list, the
 * conversation header, the project metadata, and the export can never drift,
 * and that none of them is a one-off workaround.
 *
 * WhatsApp identifies a chat or sender by a serialized JID such as
 * `<user>@c.us` (phone-based), `<user>@lid` (a privacy "Linked ID"),
 * `<id>@g.us` (group), or `<user>@s.whatsapp.net`. The user part of a
 * phone-based JID is the contact's real MSISDN, but the user part of a `@lid`
 * JID is an OPAQUE internal identifier — it is NOT a phone number and must
 * never be shown to the user or treated as one. These helpers exist to make
 * that distinction impossible to get wrong.
 */

/** JID domains whose user part is the contact's real phone number (MSISDN). */
const PHONE_BEARING_DOMAINS: ReadonlySet<string> = new Set(['c.us', 's.whatsapp.net']);

/**
 * True when `id` is a serialized WhatsApp JID (it carries an `@<domain>`), as
 * opposed to a bare token used by mock/test fixtures. A serialized JID is an
 * internal identifier and must never surface to the user as a contact name.
 */
export function isSerializedWhatsAppId(id: string): boolean {
  return id.includes('@');
}

/**
 * Resolves the real phone number encoded in a WhatsApp id, formatted
 * `+<digits>`, or `undefined` when the id carries no real number.
 *
 * Only phone-based JIDs (`@c.us`, `@s.whatsapp.net`) and bare numeric ids
 * (legacy/mock data) yield a number. A `@lid` privacy id NEVER does — its user
 * part is an opaque Linked ID, not an MSISDN — so it can never be mistaken for
 * a phone number.
 */
export function phoneFromWhatsAppId(id: string): string | undefined {
  const at = id.indexOf('@');
  if (at === -1) {
    // A bare token: only a purely numeric one is a real number.
    return /^\d+$/.test(id) ? `+${id}` : undefined;
  }
  const user = id.slice(0, at);
  const domain = id.slice(at + 1);
  if (PHONE_BEARING_DOMAINS.has(domain) && /^\d+$/.test(user)) {
    return `+${user}`;
  }
  return undefined;
}

/**
 * Sanitizes a source-provided contact name: returns the trimmed name, or
 * `null` when it is empty or is itself a serialized WhatsApp id. This keeps an
 * opaque identifier (e.g. `222436708581508@lid`) from ever being stored or
 * displayed as a contact's name.
 */
export function sanitizeContactName(name: string | null | undefined): string | null {
  if (name === null || name === undefined) {
    return null;
  }
  const trimmed = name.trim();
  if (trimmed.length === 0 || isSerializedWhatsAppId(trimmed)) {
    return null;
  }
  return trimmed;
}

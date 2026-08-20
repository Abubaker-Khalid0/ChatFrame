/**
 * Pure mapping helpers for the Baileys adapter. These translate Baileys'
 * protobuf message shapes into the project-owned representations the rest of
 * the pipeline understands. Kept separate from the adapter so the logic is
 * unit-testable and the adapter file stays focused on connection lifecycle.
 *
 * Library containment note: this module imports Baileys *types* only for
 * accuracy; nothing here is re-exported, so no library type leaks past the
 * adapter boundary (Constitution IV).
 */

/** JID suffix for one-to-one (phone-based) chats. */
export const USER_JID_SUFFIX = '@s.whatsapp.net';
/** JID suffix for LID-based (privacy) one-to-one chats. */
export const LID_JID_SUFFIX = '@lid';
/** JID suffix for group chats (excluded — one-to-one only, FR-002). */
export const GROUP_JID_SUFFIX = '@g.us';
/** JID suffix / id for broadcast and status entries (excluded). */
export const BROADCAST_JID_SUFFIX = '@broadcast';
export const STATUS_BROADCAST_JID = 'status@broadcast';

/** Maps a Baileys message content key to the project's simple type string. */
const CONTENT_TYPE_MAP: Record<string, string> = {
  conversation: 'chat',
  extendedTextMessage: 'chat',
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  documentWithCaptionMessage: 'document',
  stickerMessage: 'sticker',
  contactMessage: 'vcard',
  contactsArrayMessage: 'multi_vcard',
  locationMessage: 'location',
  liveLocationMessage: 'location',
  pollCreationMessage: 'poll_creation',
  pollCreationMessageV2: 'poll_creation',
  pollCreationMessageV3: 'poll_creation',
  ptt: 'ptt',
  audioMessagePtt: 'ptt',
  protocolMessage: 'protocol',
  reactionMessage: 'reaction',
};

/** Message content keys that carry downloadable media (consumed by US7). */
const MEDIA_CONTENT_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'documentWithCaptionMessage',
  'stickerMessage',
]);

/** Default mime types keyed by content type when none is reported. */
const DEFAULT_MIME_BY_TYPE: Record<string, string> = {
  imageMessage: 'image/jpeg',
  videoMessage: 'video/mp4',
  audioMessage: 'audio/ogg',
  stickerMessage: 'image/webp',
  documentMessage: 'application/octet-stream',
};

/** Common mime → file extension lookups for stored media. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
};

/**
 * Normalizes a Baileys timestamp to Unix seconds. Accepts the several shapes a
 * timestamp can take across the live socket and a JSON round-trip:
 *  - a plain `number` (live, or already-normalized persisted value),
 *  - a live `Long` instance (exposes `toNumber()`),
 *  - a JSON-serialized `Long` — `{ low, high, unsigned }` — which loses its
 *    prototype (and thus `toNumber`) after `JSON.parse`. This is the shape that
 *    previously coerced to `NaN` and dropped every persisted chat's timestamp.
 * Returns `undefined` for missing or non-positive values.
 */
export function toUnixSeconds(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Live Long instance — expose the exact value via its own method.
    if (typeof obj.toNumber === 'function') {
      const n = (obj as { toNumber(): number }).toNumber();
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
    }
    // JSON-deserialized Long: reconstruct from the 32-bit low/high words.
    if (typeof obj.low === 'number' && typeof obj.high === 'number') {
      const n = obj.high * 0x100000000 + (obj.low >>> 0);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
    }
  }
  const coerced = Number(value);
  return Number.isFinite(coerced) && coerced > 0 ? Math.floor(coerced) : undefined;
}

/**
 * Matches a Baileys reverse LID-mapping filename (`lid-mapping-<lid>_reverse`)
 * and captures the LID's numeric part. The reverse variant stores the phone
 * number for a given LID — the direction we need, since chats are keyed by LID
 * but contact identity is keyed by phone JID.
 */
const LID_MAPPING_REVERSE_FILE = /^lid-mapping-(\d+)_reverse\.json$/;

/**
 * Parses one Baileys reverse LID-mapping file into a `[lidJid, phoneJid]` pair,
 * or `null` when the filename isn't a reverse mapping or the content isn't a
 * plain digit string (the file holds the bare phone number as a JSON string,
 * e.g. `"971501362700"`). Pure so the bridge's parsing rules are unit-testable
 * independent of the filesystem.
 */
export function parseLidMappingFile(
  filename: string,
  content: string,
): readonly [lidJid: string, phoneJid: string] | null {
  const lid = filename.match(LID_MAPPING_REVERSE_FILE)?.[1];
  if (lid === undefined) return null;
  let phone: unknown;
  try {
    phone = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof phone !== 'string' || !/^\d+$/.test(phone)) return null;
  return [`${lid}${LID_JID_SUFFIX}`, `${phone}${USER_JID_SUFFIX}`] as const;
}

/** True when a filename is a Baileys reverse LID-mapping file. */
export function isLidMappingFile(filename: string): boolean {
  return LID_MAPPING_REVERSE_FILE.test(filename);
}

/** True when a JID represents a one-to-one (phone) chat we should list. */
export function isPrivateChatJid(jid: string | null | undefined): boolean {
  if (!jid) return false;
  if (jid === STATUS_BROADCAST_JID) return false;
  if (jid.endsWith(BROADCAST_JID_SUFFIX)) return false;
  if (jid.endsWith(GROUP_JID_SUFFIX)) return false;
  // Newsletter / channel jids end with @newsletter — exclude them too.
  if (jid.endsWith('@newsletter')) return false;
  // Accept both phone-based (@s.whatsapp.net) and privacy LID-based (@lid) JIDs.
  return jid.endsWith(USER_JID_SUFFIX) || jid.endsWith(LID_JID_SUFFIX);
}

/**
 * Extracts the bare phone-number digits (MSISDN) from a phone-based JID, or
 * `null` when the JID is an opaque `@lid` privacy id (the phone number for
 * those is resolved through the contact/lid-mapping store instead).
 */
export function phoneFromJid(jid: string): string | null {
  if (jid.endsWith(USER_JID_SUFFIX)) {
    const userPart = jid.slice(0, -USER_JID_SUFFIX.length).split(':')[0] ?? '';
    return /^\d+$/.test(userPart) ? userPart : null;
  }
  // LID JIDs are opaque — phone number comes from the contact store.
  return null;
}

/**
 * Resolves the content-type key actually present on a Baileys message,
 * transparently unwrapping the common `ephemeralMessage` /
 * `viewOnceMessage` / `documentWithCaptionMessage` envelopes so the inner
 * content type and body are surfaced (otherwise these render as "unknown").
 */
export function resolveContentType(
  message: Record<string, unknown> | null | undefined,
): { type: string; content: Record<string, unknown> } | null {
  if (!message) return null;
  let current = message;

  // Unwrap up to a few layers of known envelopes.
  for (let depth = 0; depth < 4; depth += 1) {
    const wrapperKey = (
      [
        'ephemeralMessage',
        'viewOnceMessage',
        'viewOnceMessageV2',
        'viewOnceMessageV2Extension',
        'documentWithCaptionMessage',
        'editedMessage',
      ] as const
    ).find((key) => key in current);

    if (wrapperKey === undefined) break;
    const inner = (current[wrapperKey] as Record<string, unknown> | undefined)?.message as
      | Record<string, unknown>
      | undefined;
    if (!inner) break;
    current = inner;
  }

  const key = Object.keys(current).find((k) => k in CONTENT_TYPE_MAP || MEDIA_CONTENT_TYPES.has(k));
  if (key === undefined) {
    // No recognized content key — surface the first key for traceability.
    const fallback = Object.keys(current)[0];
    return fallback ? { type: fallback, content: current } : null;
  }
  return { type: key, content: current };
}

/** Maps a Baileys content-type key to the project's simple type string. */
export function mapToSimpleType(contentTypeKey: string): string {
  return CONTENT_TYPE_MAP[contentTypeKey] ?? contentTypeKey;
}

/** True when the resolved content type carries downloadable media. */
export function hasMediaContent(contentTypeKey: string): boolean {
  return MEDIA_CONTENT_TYPES.has(contentTypeKey);
}

/**
 * Extracts the human-readable body/caption from a message's resolved content.
 * Returns an empty string for media without a caption (the caller supplies a
 * type-specific placeholder for previews).
 */
export function extractBody(
  content: Record<string, unknown>,
  contentTypeKey: string,
): string {
  if (contentTypeKey === 'conversation') {
    const text = content.conversation;
    return typeof text === 'string' ? text : '';
  }
  const inner = content[contentTypeKey];
  if (inner === undefined || inner === null || typeof inner !== 'object') return '';
  const obj = inner as Record<string, unknown>;

  const candidates = ['text', 'caption', 'title', 'name', 'fileName'] as const;
  for (const field of candidates) {
    const value = obj[field];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

/** Resolves the mime type for a media message, with a sensible default. */
export function resolveMimeType(
  content: Record<string, unknown>,
  contentTypeKey: string,
): string {
  const inner = content[contentTypeKey] as Record<string, unknown> | undefined;
  const reported = inner?.mimetype;
  if (typeof reported === 'string' && reported.length > 0) {
    // Strip any `; codecs=...` suffix.
    return reported.split(';')[0]!.trim();
  }
  return DEFAULT_MIME_BY_TYPE[contentTypeKey] ?? 'application/octet-stream';
}

/** Maps a mime type to a file extension for stored media filenames. */
export function mimeToExtension(mimeType: string): string {
  return MIME_TO_EXT[mimeType.toLowerCase()] ?? 'bin';
}

/** Extracts the quoted (replied-to) message id, when present. */
export function extractQuotedMessageId(
  content: Record<string, unknown>,
  contentTypeKey: string,
): string | undefined {
  const inner = content[contentTypeKey] as Record<string, unknown> | undefined;
  const contextInfo = inner?.contextInfo as Record<string, unknown> | undefined;
  const stanzaId = contextInfo?.stanzaId;
  return typeof stanzaId === 'string' && stanzaId.length > 0 ? stanzaId : undefined;
}

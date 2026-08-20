import { once } from 'node:events';
import type { Writable } from 'node:stream';
import {
  applyPrivacyToMessageRow,
  applyPrivacyToParticipants,
  phoneFromWhatsAppId,
  phoneNumberFor,
  PRIVACY_NAME_PLACEHOLDER,
  type ExportSettings,
  type ImageMetadata,
  type MessageRow,
  type Participant,
  type PrivacySettings,
  type RenderModel,
  type ReplyReference,
} from '@chatframe/shared';
import { escapeAttr, escapeText } from './htmlEscape';

/**
 * Static conversation HTML renderer (009 research §2, data-model §5).
 *
 * Walks the render model's `RenderEntry[]` and emits the SAME element
 * structure and `cf-*` class names as the Phase 8 preview React components, so
 * the export and the preview share one visual system (SC-007). The document
 * links `assets/fonts.css` then `assets/style.css` (the verbatim
 * `chat-renderer.css` copy — SC-008) and contains **no `<script>`** and no
 * remote URLs (FR-002, FR-009). Output is written through a `Writable` with
 * backpressure awaited so a 10k-message document is never assembled as one
 * giant in-memory string (Constitution XVIII).
 *
 * Every dynamic value passes through `htmlEscape` (research §3). Newlines are
 * preserved verbatim and rendered by the stylesheet's `pre-wrap`.
 */

export type ExportLocale = 'en' | 'ar';

export interface RenderHtmlOptions {
  settings: ExportSettings;
  locale: ExportLocale;
}

/**
 * Localized standalone chrome (009 research §4). The exported file cannot use
 * the app's i18n layer, so the non-content labels are resolved at render time;
 * message content is never translated. Strings mirror `frontend/src/i18n`.
 */
const CHROME_STRINGS: Record<
  ExportLocale,
  {
    contact: string;
    edited: string;
    deletedMessage: string;
    unsupported: string;
    unsupportedReason: string;
    missingImage: string;
    photo: string;
    replyUnavailable: string;
  }
> = {
  en: {
    contact: 'Contact',
    edited: 'edited',
    deletedMessage: 'This message was deleted',
    unsupported: 'Unsupported message',
    unsupportedReason: 'This message type cannot be displayed',
    missingImage: 'Image unavailable',
    photo: 'Photo',
    replyUnavailable: 'Original message not available',
  },
  ar: {
    contact: 'جهة اتصال',
    edited: 'مُعدّلة',
    deletedMessage: 'تم حذف هذه الرسالة',
    unsupported: 'رسالة غير مدعومة',
    unsupportedReason: 'لا يمكن عرض هذا النوع من الرسائل',
    missingImage: 'الصورة غير متوفرة',
    photo: 'صورة',
    replyUnavailable: 'الرسالة الأصلية غير متوفرة',
  },
};

/** Intl locale tags per export locale (mirrors the preview's mapping). */
const INTL_LOCALES: Record<ExportLocale, string> = { en: 'en-US', ar: 'ar' };

/* ------------------------------------------------------------------ BiDi -- */

/**
 * Per-message direction resolution, ported from
 * `frontend/src/components/preview/messageDirection.ts` (FR-022,
 * Constitution XVI): only-RTL → `rtl`, only-LTR → `ltr`, mixed → `auto`,
 * digits-only → `ltr`, otherwise `auto`.
 */
const RTL_PATTERN = new RegExp('[\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF]', 'u');
const LTR_PATTERN = new RegExp(
  '[A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF\\u1E00-\\u1EFF]',
  'u',
);

export function messageDirection(text: string | undefined): 'rtl' | 'ltr' | 'auto' {
  if (text === undefined || text.length === 0) {
    return 'auto';
  }
  const hasRtl = RTL_PATTERN.test(text);
  const hasLtr = LTR_PATTERN.test(text);
  if (hasRtl && hasLtr) {
    return 'auto';
  }
  if (hasRtl) {
    return 'rtl';
  }
  if (hasLtr) {
    return 'ltr';
  }
  if (/[0-9]/u.test(text)) {
    return 'ltr';
  }
  return 'auto';
}

/* ---------------------------------------------------------------- avatar -- */

/**
 * Deterministic generated avatar, ported from `frontend/src/lib/avatarColor.ts`
 * (Constitution XII): a fixed-palette color picked by FNV-1a hashing the
 * identity, plus the first grapheme of the display label. Real profile
 * pictures are never fetched, embedded, or referenced (FR-006).
 */
const AVATAR_PALETTE: readonly string[] = [
  '#b91c1c',
  '#c2410c',
  '#a16207',
  '#15803d',
  '#0f766e',
  '#0369a1',
  '#4338ca',
  '#7e22ce',
  '#be185d',
  '#334155',
];

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function firstGrapheme(value: string): string | null {
  if (value.length === 0) {
    return null;
  }
  if (typeof Intl.Segmenter === 'function') {
    for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
      value,
    )) {
      return segment.segment;
    }
  }
  return [...value][0] ?? null;
}

function avatarDescriptor(displayName: string): { initial: string; color: string } {
  const label = displayName.trim().replace(/^\+/, '');
  const initial = firstGrapheme(label)?.toLocaleUpperCase() ?? '?';
  const color = AVATAR_PALETTE[hashString(displayName) % AVATAR_PALETTE.length] ?? '#334155';
  return { initial, color };
}

/**
 * The avatar circle is styled inline because the export must not depend on the
 * app-chrome (Tailwind) styles, and `assets/style.css` stays byte-identical to
 * `chat-renderer.css` (SC-008) so no avatar class can be added there.
 */
const AVATAR_STYLE =
  'display:flex;align-items:center;justify-content:center;' +
  'width:40px;height:40px;border-radius:50%;flex-shrink:0;' +
  'color:#ffffff;font-weight:600;font-size:16px;user-select:none;';

function renderAvatar(displayName: string): string {
  const { initial, color } = avatarDescriptor(displayName);
  return (
    `<span role="img" aria-hidden="true" style="${AVATAR_STYLE}background-color:${color};">` +
    `${escapeText(initial)}</span>`
  );
}

/* ------------------------------------------------------------ formatting -- */

/** `HH:MM:SS` timestamp, matching the preview's `MessageBubble` (FR-003). */
function formatTime(timestampIso: string, locale: ExportLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestampIso));
}

/** Localized long day label for a date-separator pill (data-model §5). */
function formatDateLabel(dateKey: string, locale: ExportLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

/** Extracts the stored filename from a relative asset path. */
function filenameOf(path: string): string {
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] ?? path;
}

/* -------------------------------------------------------------- fragments -- */

function renderDateSeparator(dateKey: string, locale: ExportLocale): string {
  return (
    `<div class="cf-date"><span class="cf-date__badge">` +
    `${escapeText(formatDateLabel(dateKey, locale))}</span></div>`
  );
}

function renderReply(reply: ReplyReference, locale: ExportLocale): string {
  const chrome = CHROME_STRINGS[locale];
  if (!reply.resolved) {
    return (
      `<div class="cf-reply cf-reply--unresolved">` +
      `<p class="cf-reply__text">${escapeText(chrome.replyUnavailable)}</p></div>`
    );
  }
  const text =
    reply.previewType === 'image'
      ? `📷 ${reply.previewText !== undefined && reply.previewText.length > 0 ? reply.previewText : chrome.photo}`
      : (reply.previewText ?? '');
  const dir = messageDirection(reply.previewText);
  return (
    `<div class="cf-reply">` +
    `<p class="cf-reply__text" dir="${dir}">${escapeText(text)}</p></div>`
  );
}

function renderImage(image: ImageMetadata, locale: ExportLocale): string {
  const chrome = CHROME_STRINGS[locale];
  const missing = image.missing === true;
  const caption =
    image.caption !== undefined && image.caption.length > 0
      ? `<figcaption class="cf-image__caption" dir="${messageDirection(image.caption)}">` +
        `${escapeText(image.caption)}</figcaption>`
      : '';

  if (missing) {
    return (
      `<figure class="cf-image cf-image--missing">` +
      `<div class="cf-image__placeholder" role="img" aria-label="${escapeAttr(chrome.missingImage)}">` +
      `<span class="cf-image__placeholder-icon" aria-hidden="true">🖼️</span>` +
      `<span>${escapeText(chrome.missingImage)}</span></div>${caption}</figure>`
    );
  }

  // The src is always a relative `assets/media/<filename>` path built from the
  // validated MediaStore filename scheme — never arbitrary input (research §3).
  const src = `assets/media/${filenameOf(image.exportPath)}`;
  const dimensions =
    (image.width !== undefined ? ` width="${image.width}"` : '') +
    (image.height !== undefined ? ` height="${image.height}"` : '');
  const alt =
    image.caption !== undefined && image.caption.length > 0 ? image.caption : chrome.photo;
  return (
    `<figure class="cf-image">` +
    `<img class="cf-image__img" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"` +
    `${dimensions} loading="lazy" />${caption}</figure>`
  );
}

function renderBubbleBody(row: MessageRow, isDeleted: boolean, locale: ExportLocale): string {
  const chrome = CHROME_STRINGS[locale];
  if (isDeleted) {
    return `<p class="cf-bubble__body">${escapeText(chrome.deletedMessage)}</p>`;
  }
  if (row.type === 'image' && row.image !== undefined) {
    return renderImage(row.image, locale);
  }
  return (
    `<p class="cf-bubble__body" dir="${messageDirection(row.body)}">` +
    `${escapeText(row.body ?? '')}</p>`
  );
}

function renderMessageRow(row: MessageRow, showSender: boolean, locale: ExportLocale): string {
  const chrome = CHROME_STRINGS[locale];
  const isOutgoing = row.direction === 'sent';
  // The shared privacy transform leaves the placeholder token in place; the
  // standalone document resolves it to a localized neutral label (research §4).
  const senderName =
    row.senderDisplayName === PRIVACY_NAME_PLACEHOLDER
      ? chrome.contact
      : (row.senderDisplayName ?? '');

  if (row.type === 'unsupported') {
    const info = row.unsupported;
    const type =
      info !== undefined ? `${chrome.unsupported} · ${info.originalType}` : chrome.unsupported;
    const reason = info?.reason ?? chrome.unsupportedReason;
    return (
      `<div class="cf-row ${isOutgoing ? 'cf-row--out' : 'cf-row--in'} cf-row--lead">` +
      `<div class="cf-unsupported">` +
      `<span class="cf-unsupported__type">${escapeText(type)}</span>` +
      `<p class="cf-unsupported__reason">${escapeText(reason)}</p></div></div>`
    );
  }

  const isDeleted = row.isDeleted === true || row.type === 'deleted';
  const rowClass = `cf-row ${isOutgoing ? 'cf-row--out' : 'cf-row--in'}${showSender ? ' cf-row--lead' : ''}`;
  const bubbleClass = `cf-bubble ${isOutgoing ? 'cf-bubble--out' : 'cf-bubble--in'}${isDeleted ? ' cf-bubble--deleted' : ''}`;

  const sender =
    showSender && !isOutgoing
      ? `<div class="cf-bubble__sender" dir="auto">${escapeText(senderName)}</div>`
      : '';
  const reply = !isDeleted && row.replyTo !== undefined ? renderReply(row.replyTo, locale) : '';
  const edited =
    !isDeleted && row.isEdited === true
      ? `<span class="cf-bubble__edited">${escapeText(chrome.edited)}</span>`
      : '';
  const time =
    `<time class="cf-bubble__time" datetime="${escapeAttr(row.timestampIso)}">` +
    `${escapeText(formatTime(row.timestampIso, locale))}</time>`;

  return (
    `<div class="${rowClass}"><div class="${bubbleClass}">` +
    sender +
    reply +
    renderBubbleBody(row, isDeleted, locale) +
    `<div class="cf-bubble__meta">${edited}${time}</div>` +
    `</div></div>`
  );
}

/**
 * Conversation header: generated avatar plus the contact name and optional
 * phone — the only place the phone ever appears (data-model §5).
 */
function renderHeader(name: string, phone: string | undefined): string {
  const phoneHtml =
    phone !== undefined ? `<div class="cf-chat__header-phone">${escapeText(phone)}</div>` : '';
  return (
    `<header class="cf-chat__header">` +
    renderAvatar(name) +
    `<div><div class="cf-chat__header-name" dir="auto">${escapeText(name)}</div>${phoneHtml}</div>` +
    `</header>`
  );
}

/**
 * The watermark text is the FIXED string "Exported by ChatFrame" and is never
 * localized (FR-008). Styled inline because `assets/style.css` must stay
 * byte-identical to `chat-renderer.css` (SC-008).
 */
const WATERMARK_TEXT = 'Exported by ChatFrame';
const WATERMARK_STYLE =
  'flex-shrink:0;padding:6px 12px;text-align:center;' +
  'font-size:11px;color:var(--cf-text-secondary);background:var(--cf-date-bg);';

function renderWatermark(): string {
  return `<footer class="cf-watermark" style="${WATERMARK_STYLE}">${escapeText(WATERMARK_TEXT)}</footer>`;
}

/* ------------------------------------------------------------------ main -- */

/** Writes a chunk, awaiting drain when the stream signals backpressure. */
async function write(out: Writable, chunk: string): Promise<void> {
  if (!out.write(chunk)) {
    await once(out, 'drain');
  }
}

/**
 * Extracts the privacy subset of `ExportSettings` — field-compatible with the
 * shared `PrivacySettings`, so the chosen privacy flows straight through with
 * no remapping (FR-014). An empty/whitespace alias is treated as unset.
 */
function privacyOf(settings: ExportSettings): PrivacySettings {
  const alias = settings.displayAlias?.trim();
  return {
    showContactName: settings.showContactName,
    showPhoneNumber: settings.showPhoneNumber,
    ...(alias !== undefined && alias.length > 0 ? { displayAlias: alias } : {}),
  };
}

/** Resolves the header identity (contact participant) for the conversation. */
function headerContact(participants: readonly Participant[]): Participant | undefined {
  return participants.find((participant) => !participant.isMe);
}

/**
 * Renders the full static conversation document to `out`, applying the SAME
 * shared privacy transform the preview uses (`applyPrivacyToParticipants` /
 * `applyPrivacyToMessageRow`) so the two cannot drift (FR-006, Constitution
 * XII). Message content — bodies, captions, reply previews — is never altered
 * by privacy. The caller ends the stream.
 */
export async function renderConversationHtml(
  model: RenderModel,
  options: RenderHtmlOptions,
  out: Writable,
): Promise<void> {
  const { settings, locale } = options;
  const privacy = privacyOf(settings);

  const participants = applyPrivacyToParticipants(model.participants, privacy);
  const contact = headerContact(participants);
  const contactName =
    contact === undefined || contact.displayName === PRIVACY_NAME_PLACEHOLDER
      ? CHROME_STRINGS[locale].contact
      : contact.displayName;
  // Prefer the real number resolved during normalization; fall back to one
  // derived from a phone-based id. A `@lid` privacy id never yields a number.
  const contactPhone =
    contact !== undefined
      ? phoneNumberFor(contact.phoneNumber ?? phoneFromWhatsAppId(contact.id), privacy)
      : undefined;

  await write(
    out,
    `<!doctype html>\n<html lang="${escapeAttr(locale)}">\n<head>\n` +
      `<meta charset="utf-8" />\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
      `<title>${escapeText(contactName)}</title>\n` +
      `<link rel="stylesheet" href="assets/fonts.css" />\n` +
      `<link rel="stylesheet" href="assets/style.css" />\n` +
      `</head>\n<body>\n` +
      `<div class="cf-chat-shell">\n` +
      `<div class="cf-chat" data-theme="${escapeAttr(settings.theme)}">\n` +
      `${renderHeader(contactName, contactPhone)}\n` +
      `<div class="cf-chat__scroll">\n`,
  );

  let previous: MessageRow | undefined;
  for (const entry of model.entries) {
    if (entry.kind === 'date-separator') {
      await write(out, `${renderDateSeparator(entry.dateKey, locale)}\n`);
      continue;
    }
    // First of a consecutive same-sender same-day run leads the group (FR-026).
    const showSender =
      previous === undefined ||
      previous.senderId !== entry.senderId ||
      previous.dateKey !== entry.dateKey;
    const row = applyPrivacyToMessageRow(entry, privacy);
    await write(out, `${renderMessageRow(row, showSender, locale)}\n`);
    previous = entry;
  }

  // Visible watermark footer, included only when enabled (FR-008, US4).
  const watermark = settings.showWatermark ? `${renderWatermark()}\n` : '';
  await write(out, `</div>\n${watermark}</div>\n</div>\n</body>\n</html>\n`);
}

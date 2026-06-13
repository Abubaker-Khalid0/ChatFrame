import type { RawWhatsAppMessage } from '@chatframe/shared';

/**
 * Large conversation fixture generator (010 data-model §3.1, research §7).
 *
 * Produces a synthetic `RawWhatsAppMessage[]` at smoke-test scale (5,000+
 * messages by default) with mixed types, languages, date boundaries, replies,
 * deleted/unsupported messages, and long bodies. Generation is fully
 * deterministic for a given config + seed (Constitution IX) so the smoke
 * tests in `backend/tests/smoke/` are reproducible.
 */

export interface SmokeTestConfig {
  /** Total messages to generate. */
  messageCount: number;
  /** How many messages are images (with media references). */
  imageCount: number;
  /** Fraction of messages that quote an earlier message. */
  replyPercentage: number;
  /** How many messages are deleted (`revoked`). */
  deletedCount: number;
  /** How many messages use an unsupported raw type. */
  unsupportedCount: number;
  /** How many text messages have long bodies (500+ chars). */
  longMessageCount: number;
  /** Language mix drawn from per message. */
  languages: ('ar' | 'en' | 'mixed')[];
  /** Distinct calendar days the conversation spans. */
  dateBoundaries: number;
}

export const DEFAULT_SMOKE_CONFIG: SmokeTestConfig = {
  messageCount: 5000,
  imageCount: 200,
  replyPercentage: 0.15,
  deletedCount: 50,
  unsupportedCount: 30,
  longMessageCount: 20,
  languages: ['ar', 'en', 'mixed'],
  dateBoundaries: 30,
};

/** The synthetic chat all fixture messages belong to. */
export const SMOKE_CHAT_ID = 'smoke-chat-001@c.us';

/** The synthetic contact (the non-`fromMe` author). */
export const SMOKE_CONTACT_ID = 'smoke-contact-001@c.us';

/** Fixed conversation start so output never depends on the wall clock. */
const START_EPOCH_SECONDS = Date.UTC(2025, 0, 1, 8, 0, 0) / 1000;

/** Raw source types that map to `unsupported` after normalization. */
const UNSUPPORTED_RAW_TYPES = ['sticker', 'ptt', 'video', 'document', 'location'] as const;

const EN_BODIES = [
  'Hey, how are you doing today?',
  'Did you see the photos from the trip?',
  "Let's meet tomorrow at the usual place.",
  'That sounds great, count me in!',
  'I will send you the details later tonight.',
  'Thanks a lot, really appreciate it.',
];

const AR_BODIES = [
  'مرحبًا، كيف حالك اليوم؟',
  'هل شاهدت صور الرحلة؟',
  'لنلتقِ غدًا في المكان المعتاد.',
  'فكرة رائعة، أنا موافق!',
  'سأرسل لك التفاصيل الليلة.',
  'شكرًا جزيلًا، أقدّر ذلك كثيرًا.',
];

const MIXED_BODIES = [
  'تمام، see you at 5 إن شاء الله',
  'Check this out يا صديقي، رابط مفيد جدًا',
  'OK تمام، أرسل لي الـ details',
];

/** Deterministic 32-bit PRNG (mulberry32) — small, fast, seedable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks `count` distinct indices in `[0, total)` deterministically. */
function pickIndices(
  total: number,
  count: number,
  taken: Set<number>,
  rng: () => number,
): number[] {
  const picked: number[] = [];
  while (picked.length < count) {
    const index = Math.floor(rng() * total);
    if (!taken.has(index)) {
      taken.add(index);
      picked.push(index);
    }
  }
  return picked;
}

function pickBody(languages: SmokeTestConfig['languages'], rng: () => number): string {
  const language = languages[Math.floor(rng() * languages.length)] ?? 'en';
  const pool = language === 'ar' ? AR_BODIES : language === 'mixed' ? MIXED_BODIES : EN_BODIES;
  return pool[Math.floor(rng() * pool.length)] ?? EN_BODIES[0]!;
}

/** Builds a 500+ char body by repeating a base sentence (data-model §3.1). */
function longBody(rng: () => number, languages: SmokeTestConfig['languages']): string {
  const base = pickBody(languages, rng);
  let body = base;
  while (body.length < 600) {
    body += ` ${base}`;
  }
  return body;
}

/**
 * Generates the deterministic large conversation fixture. The output is valid
 * against `RawWhatsAppMessageSchema` and chronologically ordered, spanning
 * `dateBoundaries` distinct days. A handful of records omit `timestamp` to
 * exercise the synthetic-timestamp fallback (FR-003).
 */
export function generateLargeFixture(
  overrides: Partial<SmokeTestConfig> = {},
  seed = 20260612,
): RawWhatsAppMessage[] {
  const config: SmokeTestConfig = { ...DEFAULT_SMOKE_CONFIG, ...overrides };
  const specialTotal =
    config.imageCount + config.deletedCount + config.unsupportedCount + config.longMessageCount;
  if (specialTotal > config.messageCount) {
    throw new Error(
      `Invalid smoke config: special message counts (${specialTotal}) exceed messageCount (${config.messageCount})`,
    );
  }

  const rng = mulberry32(seed);

  // Assign special-type slots without collisions, deterministically.
  const taken = new Set<number>();
  const imageIndices = new Set(pickIndices(config.messageCount, config.imageCount, taken, rng));
  const deletedIndices = new Set(pickIndices(config.messageCount, config.deletedCount, taken, rng));
  const unsupportedIndices = pickIndices(config.messageCount, config.unsupportedCount, taken, rng);
  const unsupportedSet = new Set(unsupportedIndices);
  const longIndices = new Set(
    pickIndices(config.messageCount, config.longMessageCount, taken, rng),
  );

  // Spread messages evenly across the configured number of distinct days.
  const messagesPerDay = Math.max(1, Math.ceil(config.messageCount / config.dateBoundaries));

  const messages: RawWhatsAppMessage[] = [];
  for (let i = 0; i < config.messageCount; i++) {
    const day = Math.floor(i / messagesPerDay);
    const positionInDay = i % messagesPerDay;
    // Each day starts at 08:00 UTC; messages are 5–65 seconds apart.
    const timestamp =
      START_EPOCH_SECONDS + day * 86_400 + positionInDay * (5 + Math.floor(rng() * 60));

    const fromMe = rng() < 0.5;
    const id = `smoke-msg-${String(i).padStart(5, '0')}`;

    let type = 'chat';
    let body = '';
    let hasMedia = false;
    let mediaId: string | undefined;
    let caption: string | undefined;

    if (imageIndices.has(i)) {
      type = 'image';
      hasMedia = true;
      mediaId = `smoke-media-${String(i).padStart(5, '0')}`;
      if (rng() < 0.4) {
        caption = pickBody(config.languages, rng);
      }
    } else if (deletedIndices.has(i)) {
      type = 'revoked';
    } else if (unsupportedSet.has(i)) {
      type =
        UNSUPPORTED_RAW_TYPES[unsupportedIndices.indexOf(i) % UNSUPPORTED_RAW_TYPES.length] ??
        'sticker';
    } else if (longIndices.has(i)) {
      body = longBody(rng, config.languages);
    } else {
      body = pickBody(config.languages, rng);
    }

    // Replies quote a random earlier message (resolved by the replies stage).
    const isReply = i > 0 && rng() < config.replyPercentage;
    const quotedIndex = isReply ? Math.floor(rng() * i) : undefined;

    messages.push({
      id,
      chatId: SMOKE_CHAT_ID,
      fromMe,
      author: fromMe ? null : SMOKE_CONTACT_ID,
      // Every 1000th record omits its timestamp to exercise the synthetic
      // fallback path (FR-003) at scale.
      ...(i % 1000 === 500 ? {} : { timestamp }),
      type,
      body,
      hasMedia,
      ...(mediaId !== undefined ? { mediaId } : {}),
      ...(caption !== undefined ? { caption } : {}),
      ...(quotedIndex !== undefined
        ? { quotedMessageId: `smoke-msg-${String(quotedIndex).padStart(5, '0')}` }
        : {}),
      ...(rng() < 0.02 ? { isEdited: true } : {}),
    });
  }

  return messages;
}

/** Serializes a fixture to NDJSON, matching `raw/messages.raw.ndjson` format. */
export function serializeFixtureToNdjson(messages: RawWhatsAppMessage[]): string {
  return messages.map((message) => JSON.stringify(message)).join('\n') + '\n';
}

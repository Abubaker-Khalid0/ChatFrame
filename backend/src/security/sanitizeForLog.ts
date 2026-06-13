/**
 * Log sanitization (FR-013, Constitution XIII): QR codes, authentication
 * tokens, and session secrets must never reach any log output. This utility
 * strips sensitive data from arbitrary log payloads and is registered as a
 * Pino serializer on the `whatsapp` log child (research §8), so it runs
 * automatically on every log call — no per-call redaction to forget.
 */

const REDACTED = '[REDACTED]';

/**
 * Key words whose values are always redacted, wherever they appear. Keys are
 * split on underscores, dashes, and camelCase humps, so `authToken`,
 * `refresh_token`, and `sessionKey` all match — while `author` does not.
 */
const SENSITIVE_KEY_WORDS = new Set([
  'qr',
  'token',
  'tokens',
  'secret',
  'secrets',
  'password',
  'passphrase',
  'credential',
  'credentials',
  'cookie',
  'cookies',
  'auth',
  'apikey',
  'key',
  'keys',
]);

function isSensitiveKey(key: string): boolean {
  return key
    .split(/[_\-\s]+|(?=[A-Z])/)
    .some((word) => SENSITIVE_KEY_WORDS.has(word.toLowerCase()));
}

/**
 * WhatsApp Web QR payloads look like `2@<base64...>,<base64...>,…`. Any such
 * shape is redacted even under an innocent-looking key — including when it is
 * embedded inside a longer string such as an error message (010 US7 audit).
 */
const QR_VALUE_PATTERN = /\d@[A-Za-z0-9+/=]{8,}(?:,[A-Za-z0-9+/=]+)*/g;

const MAX_DEPTH = 8;

function sanitizeString(value: string): string {
  return value.replace(QR_VALUE_PATTERN, REDACTED);
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= MAX_DEPTH || seen.has(value)) {
    return REDACTED;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1, seen));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      // The first stack line repeats the message — sanitize it too.
      ...(value.stack !== undefined ? { stack: sanitizeString(value.stack) } : {}),
    };
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(entry, depth + 1, seen);
  }
  return result;
}

/**
 * Returns a deep copy of `payload` with all sensitive session data removed:
 * values under sensitive keys (qr, token, secret, auth, …) and any string that
 * looks like a WhatsApp QR payload. Safe on circular structures.
 */
export function sanitizeForLog(payload: unknown): unknown {
  return sanitizeValue(payload, 0, new WeakSet());
}

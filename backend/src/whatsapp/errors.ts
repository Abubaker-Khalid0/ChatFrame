/**
 * Typed adapter error conditions the API layer can detect without inspecting
 * library internals (Constitution IV). Plain classes — no library types.
 */

/**
 * Thrown by an adapter when a data operation requires a `connected` session
 * but the session is not connected (FR-006). The chats route maps this to a
 * structured `409 SESSION_NOT_CONNECTED`, distinct from unexpected failures.
 */
export class WhatsAppNotConnectedError extends Error {
  constructor() {
    super('WhatsApp session is not connected.');
    this.name = 'WhatsAppNotConnectedError';
  }
}

/**
 * Thrown when the WhatsApp session has timed out or was revoked from the
 * phone (auth failure after a previously valid session). Distinct from
 * "never connected" so the user is told to re-scan the QR code. Mapped to
 * `409 SESSION_EXPIRED` (data-model 010 §1.2/§1.3).
 */
export class SessionExpiredError extends Error {
  readonly code: string;

  constructor(message = 'WhatsApp session has expired.', code = 'SESSION_EXPIRED') {
    super(message);
    this.name = 'SessionExpiredError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Generic adapter failure not covered by a more specific error type — e.g.
 * the underlying library threw unexpectedly. Carries a redaction-safe message
 * only (no library internals, Constitution IV). Mapped to `500 ADAPTER_ERROR`
 * (data-model 010 §1.2).
 */
export class AdapterError extends Error {
  readonly code: string;

  constructor(message: string, code = 'ADAPTER_ERROR') {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

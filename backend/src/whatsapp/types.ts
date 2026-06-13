/**
 * Adapter-internal types (see contracts/adapter.md). These are project-owned
 * representations that cross the adapter boundary — they deliberately do NOT
 * reference any messaging library type (Constitution IV — no library leakage).
 * `RawWhatsAppMessage` now lives in `@chatframe/shared` (validated at the
 * raw-read boundary, FR-001) and is re-exported here so existing adapter code
 * keeps importing it from this module.
 */

export type { RawWhatsAppMessage } from '@chatframe/shared';

/** Options for streaming messages from a chat. */
export interface FetchMessagesOptions {
  /** Max messages to fetch (undefined = all). */
  limit?: number;
  /** Fetch messages before this ISO timestamp. */
  before?: string;
  /** Fetch messages after this ISO timestamp. */
  after?: string;
}

/** Binary media downloaded for an image message. */
export interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

/**
 * Session metadata reported by an adapter alongside its `ConnectionState`
 * (see specs/005 data-model.md `SessionStatus`). Project-owned — no library
 * type appears here (Constitution IV).
 */
export interface SessionInfo {
  /** Whether a silent session restore attempt is in progress (FR-008). */
  isRestoring: boolean;
  /** ISO 8601 timestamp when the connection was established, or `null`. */
  connectedAt: string | null;
  /** User-friendly error for failed states, or `null`. */
  error: string | null;
}

import type { ChatSummary, ConnectionState } from '@chatframe/shared';
import type {
  DownloadedMedia,
  FetchMessagesOptions,
  RawWhatsAppMessage,
  SessionInfo,
} from './types';

/**
 * The contract between ChatFrame and any WhatsApp integration library
 * (see contracts/adapter.md). It isolates all WhatsApp-specific behaviour so
 * the rest of the application never depends on a concrete library
 * (Constitution IV).
 *
 * Read-only by design: there are no methods to send, edit, or delete messages
 * (Constitution II).
 */
export interface WhatsAppAdapter {
  // --- Lifecycle ---
  /** Start the adapter; begin session restoration or QR generation. */
  initialize(): Promise<void>;
  /** End the current session cleanly. */
  logout(): Promise<void>;
  /** Tear down the adapter and release resources. */
  destroy(): Promise<void>;

  // --- Connection state ---
  /** Return the current connection state synchronously. */
  getConnectionState(): ConnectionState;
  /** Return session metadata (restore flag, connect time, last error). */
  getSessionInfo(): SessionInfo;
  /** Register a callback for QR code updates (`expiresIn` in seconds). */
  onQr(callback: (qr: string, expiresIn: number) => void): void;
  /** Register a callback for connection state transitions. */
  onStateChange(callback: (state: ConnectionState, error: string | null) => void): void;

  // --- Data access (read-only) ---
  /** List all one-to-one chats (no groups). */
  listPrivateChats(): Promise<ChatSummary[]>;
  /** Stream messages from a chat (memory-safe for large conversations). */
  fetchMessages(chatId: string, options: FetchMessagesOptions): AsyncIterable<RawWhatsAppMessage>;
  /** Download media for an image message, or `null` if unavailable. */
  downloadImage(message: RawWhatsAppMessage): Promise<DownloadedMedia | null>;
}

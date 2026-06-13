import WAWebJS from 'whatsapp-web.js';
import { ChatSummarySchema, type ChatSummary, type ConnectionState } from '@chatframe/shared';
import type { WhatsAppAdapter } from './WhatsAppAdapter';
import type {
  DownloadedMedia,
  FetchMessagesOptions,
  RawWhatsAppMessage,
  SessionInfo,
} from './types';
import { whatsappWebJsSessionPath } from '../config/paths';
import { isEmptyChat, toChatSummary, type RawChatInfo } from './chatMapping';
import { SessionExpiredError, WhatsAppNotConnectedError } from './errors';
import * as sessionStore from './sessionStore';

const { Client, LocalAuth } = WAWebJS;

/** whatsapp-web.js refreshes the QR roughly every 20 seconds (research §5). */
const QR_REFRESH_SECONDS = 20;

/** User-facing messages — diagnostic detail goes to the (sanitized) log only. */
const MSG_SESSION_EXPIRED = 'Session expired. Please reconnect.';
const MSG_COULD_NOT_START = 'WhatsApp integration could not start.';
const MSG_AUTH_FAILED = 'WhatsApp could not authenticate this device.';

/** Minimal structural logger so this module does not depend on Fastify. */
export interface AdapterLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/**
 * The real {@link WhatsAppAdapter} backed by `whatsapp-web.js` (FR-001).
 *
 * Library containment (FR-002, SC-008): every `whatsapp-web.js` type stays
 * inside this file — callbacks and return values use only project-owned types
 * from `@chatframe/shared` and `./types`.
 *
 * Read-only by design (FR-003, Constitution II): there are no send, edit,
 * delete, or any other write-operation methods toward WhatsApp.
 *
 * Session files are persisted by `LocalAuth` under the dedicated session
 * directory (FR-012); `initialize()` silently restores a saved session when
 * one exists (FR-008) and starts a QR flow otherwise (FR-004).
 */
export class WhatsappWebJsAdapter implements WhatsAppAdapter {
  private client: WAWebJS.Client | null = null;
  private state: ConnectionState = 'disconnected';
  private restoring = false;
  private connectedAt: string | null = null;
  private lastError: string | null = null;
  private qrListeners: Array<(qr: string, expiresIn: number) => void> = [];
  private stateListeners: Array<(state: ConnectionState, error: string | null) => void> = [];
  /** Library messages with media, kept so `downloadImage` can resolve them. */
  private mediaMessages = new Map<string, WAWebJS.Message>();

  constructor(private readonly logger?: AdapterLogger) {}

  // --- Lifecycle ---

  /**
   * Starts the connection process and resolves as soon as the client is
   * launching — progress is reported through `onStateChange`/`onQr` so the
   * HTTP route can answer immediately (SC-001). With a saved session the
   * flow is `initializing` → `connecting` (silent restore, FR-008); without
   * one it is `initializing` → `waiting_for_qr` → `qr_ready` (FR-004,
   * FR-005). A Chromium launch failure maps to `connection_failed` (FR-025).
   */
  async initialize(): Promise<void> {
    if (this.client !== null) {
      return; // Already initializing or connected; the route mutex guards re-entry.
    }
    const hadSession = await sessionStore.sessionExists();
    this.restoring = hadSession;
    this.lastError = null;
    this.setState('initializing');

    await sessionStore.ensureSessionDir();
    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: whatsappWebJsSessionPath() }),
      puppeteer: { headless: true },
    });
    this.client = client;

    client.on('qr', (qr: string) => {
      void this.handleQr(qr);
    });
    client.on('authenticated', () => {
      this.setState('connecting');
    });
    client.on('ready', () => {
      this.restoring = false;
      this.connectedAt = new Date().toISOString();
      this.setState('connected');
    });
    client.on('auth_failure', (message?: string) => {
      void this.handleAuthFailure(message ?? 'unknown auth failure');
    });
    client.on('disconnected', (reason: unknown) => {
      void this.handleDisconnected(reason);
    });

    this.setState(hadSession ? 'connecting' : 'waiting_for_qr');

    void client.initialize().catch((error: unknown) => {
      this.handleInitializeError(error);
    });
  }

  /** Ends the session: unlink on the WhatsApp side, then tear down (FR-010). */
  async logout(): Promise<void> {
    const client = this.client;
    this.connectedAt = null;
    if (client !== null) {
      try {
        await client.logout();
      } catch (error) {
        // The session may already be invalid; teardown still proceeds.
        this.logger?.warn({ details: error }, 'whatsapp logout reported an error');
      }
      await this.teardownClient();
    }
    this.setState('disconnected');
  }

  async destroy(): Promise<void> {
    await this.teardownClient();
    this.qrListeners = [];
    this.stateListeners = [];
    this.mediaMessages.clear();
  }

  // --- Connection state ---

  getConnectionState(): ConnectionState {
    return this.state;
  }

  getSessionInfo(): SessionInfo {
    return { isRestoring: this.restoring, connectedAt: this.connectedAt, error: this.lastError };
  }

  onQr(callback: (qr: string, expiresIn: number) => void): void {
    this.qrListeners.push(callback);
  }

  onStateChange(callback: (state: ConnectionState, error: string | null) => void): void {
    this.stateListeners.push(callback);
  }

  // --- Data access (read-only) ---

  async listPrivateChats(): Promise<ChatSummary[]> {
    const client = this.requireClient();
    const chats = await client.getChats();
    const summaries = chats
      .filter((chat) => !chat.isGroup) // FR-002: one-to-one chats only.
      .map((chat) => this.toRawChatInfo(chat))
      .filter((chat) => !isEmptyChat(chat)) // FR-021: nothing to archive.
      .map(toChatSummary);
    // Library data is validated before it crosses the adapter boundary
    // (Constitution XIV).
    return ChatSummarySchema.array().parse(summaries);
  }

  async *fetchMessages(
    chatId: string,
    options: FetchMessagesOptions,
  ): AsyncIterable<RawWhatsAppMessage> {
    const client = this.requireClient();
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: options.limit ?? Number.MAX_SAFE_INTEGER });
    const before = options.before !== undefined ? Date.parse(options.before) / 1000 : undefined;
    const after = options.after !== undefined ? Date.parse(options.after) / 1000 : undefined;

    for (const message of messages) {
      if (before !== undefined && message.timestamp >= before) continue;
      if (after !== undefined && message.timestamp <= after) continue;
      if (message.hasMedia) {
        this.mediaMessages.set(message.id._serialized, message);
      }
      yield this.toRawMessage(chatId, message);
    }
  }

  async downloadImage(message: RawWhatsAppMessage): Promise<DownloadedMedia | null> {
    const libraryMessage = this.mediaMessages.get(message.id);
    if (libraryMessage === undefined) {
      return null;
    }
    try {
      const media = await libraryMessage.downloadMedia();
      return {
        buffer: Buffer.from(media.data, 'base64'),
        mimeType: media.mimetype,
        filename: media.filename ?? `${message.id}.bin`,
      };
    } catch (error) {
      this.logger?.warn({ details: error }, 'media download failed');
      return null;
    }
  }

  // --- Internals (library types never escape this file) ---

  private async handleQr(qr: string): Promise<void> {
    if (this.restoring) {
      // A QR during restore means the saved session is invalid or revoked —
      // restore failed (FR-008): clean up and surface `session_expired`.
      this.restoring = false;
      this.logger?.warn({}, 'session restore failed; cleaning up saved session');
      await this.teardownClient();
      await sessionStore.clearSession();
      this.setState('session_expired', MSG_SESSION_EXPIRED);
      return;
    }
    this.emitQr(qr, QR_REFRESH_SECONDS);
    this.setState('qr_ready');
  }

  private async handleAuthFailure(message: string): Promise<void> {
    this.logger?.warn({ details: message }, 'whatsapp authentication failed');
    const wasRestoring = this.restoring;
    this.restoring = false;
    await this.teardownClient();
    if (wasRestoring) {
      await sessionStore.clearSession();
      this.setState('session_expired', MSG_SESSION_EXPIRED);
    } else {
      this.setState('connection_failed', MSG_AUTH_FAILED);
    }
  }

  private async handleDisconnected(reason: unknown): Promise<void> {
    this.logger?.warn({ details: reason }, 'whatsapp client disconnected');
    const wasConnected = this.state === 'connected';
    this.connectedAt = null;
    this.restoring = false;
    await this.teardownClient();
    if (wasConnected) {
      // Remote revocation (Linked Devices → log out) while connected.
      this.setState('session_expired', MSG_SESSION_EXPIRED);
    } else {
      this.setState('disconnected');
    }
  }

  private handleInitializeError(error: unknown): void {
    // Chromium/Puppeteer launch failure (FR-025): diagnostics are logged
    // (sanitized, FR-013); the user sees only a friendly message.
    this.logger?.error({ details: error }, 'whatsapp client failed to initialize');
    this.restoring = false;
    void this.teardownClient();
    this.setState('connection_failed', MSG_COULD_NOT_START);
  }

  private async teardownClient(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client !== null) {
      try {
        await client.destroy();
      } catch (error) {
        this.logger?.warn({ details: error }, 'whatsapp client teardown reported an error');
      }
    }
  }

  private requireClient(): WAWebJS.Client {
    if (this.state === 'session_expired') {
      // An expired/revoked session is surfaced distinctly so the user is told
      // to re-scan the QR code rather than just "reconnect" (010 US1).
      throw new SessionExpiredError();
    }
    if (this.client === null || this.state !== 'connected') {
      // Typed so the API layer can answer 409 instead of a generic 500
      // (FR-006).
      throw new WhatsAppNotConnectedError();
    }
    return this.client;
  }

  /** Reduces a library chat to the project-owned shape `chatMapping` consumes. */
  private toRawChatInfo(chat: WAWebJS.Chat): RawChatInfo {
    const lastMessage = chat.lastMessage;
    return {
      id: chat.id._serialized,
      name: chat.name ?? null,
      isGroup: chat.isGroup,
      user: chat.id.user ?? null,
      timestamp: typeof chat.timestamp === 'number' && chat.timestamp > 0 ? chat.timestamp : null,
      lastMessage:
        lastMessage !== undefined && lastMessage !== null
          ? { type: String(lastMessage.type), body: lastMessage.body ?? '' }
          : null,
    };
  }

  private toRawMessage(chatId: string, message: WAWebJS.Message): RawWhatsAppMessage {
    const raw: RawWhatsAppMessage = {
      id: message.id._serialized,
      chatId,
      fromMe: message.fromMe,
      author: message.author ?? (message.fromMe ? 'me' : (message.from ?? null)),
      type: String(message.type),
      body: message.body ?? '',
      hasMedia: message.hasMedia,
    };
    if (typeof message.timestamp === 'number' && message.timestamp >= 0) {
      raw.timestamp = message.timestamp;
    }
    return raw;
  }

  private emitQr(qr: string, expiresIn: number): void {
    for (const listener of this.qrListeners) {
      listener(qr, expiresIn);
    }
  }

  private setState(state: ConnectionState, error: string | null = null): void {
    this.state = state;
    this.lastError = error;
    for (const listener of this.stateListeners) {
      listener(state, error);
    }
  }
}

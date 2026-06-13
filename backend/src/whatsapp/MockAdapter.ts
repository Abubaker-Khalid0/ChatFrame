import { ChatSummarySchema, type ChatSummary, type ConnectionState } from '@chatframe/shared';
import type { WhatsAppAdapter } from './WhatsAppAdapter';
import type {
  DownloadedMedia,
  FetchMessagesOptions,
  RawWhatsAppMessage,
  SessionInfo,
} from './types';
import { isEmptyChat, toChatSummary } from './chatMapping';
import { mockRawChats } from './fixtures/mock-chat-list';
import {
  FORCED_FAILURE_MEDIA_ID,
  MOCK_FATAL_CHAT_ID,
  MOCK_IMAGE_BYTES,
  mockImportMessages,
} from './fixtures/mock-import-messages';
import * as sessionStore from './sessionStore';

/** QR refresh interval the mock reports, mirroring whatsapp-web.js (~20s). */
const MOCK_QR_EXPIRES_IN = 20;

/** Deterministic QR payload the mock emits (never a real credential). */
export const MOCK_QR_VALUE = 'mock-qr-payload';

/** Tuning knobs for the synthetic import stream (007 FR-024). */
export interface MockAdapterOptions {
  /** Per-yield delay in `fetchMessages` so cancel/progress are observable. */
  messageDelayMs?: number;
  /** Per-download delay in `downloadImage`. */
  imageDelayMs?: number;
  /** Overrides the fixture message stream (e.g. for cadence tests). */
  messages?: (chatId: string) => RawWhatsAppMessage[];
  /** Extra media ids that force the download-failure path. */
  failMediaIds?: readonly string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A synthetic implementation of {@link WhatsAppAdapter} that returns fixture
 * data instantly, with no network access and no simulated delay (FR-006). It
 * lets the entire application flow run without a real WhatsApp connection
 * (Constitution XX — testable core logic).
 *
 * The mock simulates the full connection lifecycle deterministically:
 * - `initialize()` with no saved session runs the QR flow
 *   (`initializing` → `waiting_for_qr` → QR emit → `qr_ready`).
 * - `initialize()` with a saved session simulates silent restore
 *   (`initializing` → `connecting` → `connected`), unless any session file
 *   contains the marker string `corrupt`, in which case the restore fails,
 *   the files are cleaned up, and the state becomes `session_expired` —
 *   mirroring the real adapter (FR-008).
 */
export class MockAdapter implements WhatsAppAdapter {
  private readonly options: MockAdapterOptions;
  private state: ConnectionState = 'disconnected';
  private stateListeners: Array<(state: ConnectionState, error: string | null) => void> = [];
  private qrListeners: Array<(qr: string, expiresIn: number) => void> = [];
  private restoring = false;
  private connectedAt: string | null = null;
  private lastError: string | null = null;

  constructor(options: MockAdapterOptions = {}) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    if (
      this.state !== 'disconnected' &&
      this.state !== 'session_expired' &&
      this.state !== 'connection_failed'
    ) {
      return;
    }
    const hasSession = await sessionStore.sessionExists();
    this.lastError = null;
    this.setState('initializing');

    if (!hasSession) {
      this.setState('waiting_for_qr');
      this.emitQr(MOCK_QR_VALUE, MOCK_QR_EXPIRES_IN);
      this.setState('qr_ready');
      return;
    }

    this.restoring = true;
    this.setState('connecting');
    const corrupted = await this.sessionIsCorrupted();
    this.restoring = false;
    if (corrupted) {
      await sessionStore.clearSession();
      this.setState('session_expired', 'Session expired. Please reconnect.');
      return;
    }
    this.connectedAt = new Date().toISOString();
    this.setState('connected');
  }

  logout(): Promise<void> {
    this.connectedAt = null;
    this.lastError = null;
    this.setState('disconnected');
    return Promise.resolve();
  }

  destroy(): Promise<void> {
    this.stateListeners = [];
    this.qrListeners = [];
    return Promise.resolve();
  }

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

  /** A session is "corrupted" when any session file contains `corrupt`. */
  private async sessionIsCorrupted(): Promise<boolean> {
    for (const file of await sessionStore.listSessionFiles()) {
      const contents = await sessionStore.readSessionFile(file);
      if (contents !== null && contents.includes('corrupt')) {
        return true;
      }
    }
    return false;
  }

  private emitQr(qr: string, expiresIn: number): void {
    for (const listener of this.qrListeners) {
      listener(qr, expiresIn);
    }
  }

  listPrivateChats(): Promise<ChatSummary[]> {
    // Mock mode reports connected for dev (contracts/chats-api.md): fixtures
    // are served regardless of the simulated lifecycle state so the picker is
    // usable without a connect flow. The typed not-connected condition
    // (`WhatsAppNotConnectedError`) is exercised against this adapter by
    // stubbing this method in route tests.
    //
    // The mock exercises the same mapping path as the real adapter: groups and
    // empty chats are excluded (FR-002, FR-021) and the result is parsed
    // against the shared schema before crossing the boundary (FR-011).
    const chats = mockRawChats
      .filter((chat) => !chat.isGroup && !isEmptyChat(chat))
      .map(toChatSummary);
    return Promise.resolve(ChatSummarySchema.array().parse(chats));
  }

  async *fetchMessages(
    chatId: string,
    options: FetchMessagesOptions,
  ): AsyncIterable<RawWhatsAppMessage> {
    // Fatal-error injection hook (007 US5): a designated chat id simulates an
    // adapter failure mid-fetch so the failed path is testable end-to-end.
    if (chatId === MOCK_FATAL_CHAT_ID) {
      throw new Error('Mock adapter failure: fetchMessages aborted');
    }

    // The mock streams the synthetic fixture set covering every normalization
    // path (007 FR-024), honouring the streaming contract (Constitution XVIII).
    // The optional per-yield delay makes progress and cancellation observable.
    const sample = (this.options.messages ?? mockImportMessages)(chatId);
    const limit = options.limit ?? sample.length;
    const delayMs = this.options.messageDelayMs ?? 0;

    for (const message of sample.slice(0, limit)) {
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      yield message;
    }
  }

  async downloadImage(message: RawWhatsAppMessage): Promise<DownloadedMedia | null> {
    const mediaId = message.mediaId;
    if (mediaId === undefined) {
      return null;
    }
    const delayMs = this.options.imageDelayMs ?? 0;
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    // Forced-failure markers exercise retry exhaustion → missing (007 FR-024).
    if (mediaId === FORCED_FAILURE_MEDIA_ID || this.options.failMediaIds?.includes(mediaId)) {
      return null;
    }
    return {
      buffer: MOCK_IMAGE_BYTES,
      mimeType: 'image/png',
      filename: `${mediaId}.png`,
    };
  }

  private setState(state: ConnectionState, error: string | null = null): void {
    this.state = state;
    this.lastError = error;
    for (const listener of this.stateListeners) {
      listener(state, error);
    }
  }
}

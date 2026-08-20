import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type ConnectionState as BaileysConnectionState,
  type Chat,
  type Contact,
  type WAMessage,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { ChatSummarySchema, type ChatSummary, type ConnectionState } from '@chatframe/shared';
import type { WhatsAppAdapter } from './WhatsAppAdapter';
import type {
  DownloadedMedia,
  FetchMessagesOptions,
  RawWhatsAppMessage,
  SessionInfo,
} from './types';
import { isEmptyChat, toChatSummary, type RawChatInfo } from './chatMapping';
import {
  extractBody,
  extractQuotedMessageId,
  hasMediaContent,
  isLidMappingFile,
  isPrivateChatJid,
  LID_JID_SUFFIX,
  mapToSimpleType,
  mimeToExtension,
  parseLidMappingFile,
  phoneFromJid,
  resolveContentType,
  resolveMimeType,
  toUnixSeconds,
  USER_JID_SUFFIX,
} from './baileysMapping';
import { baileysSessionPath } from '../config/paths';
import { WhatsAppNotConnectedError } from './errors';
import * as sessionStore from './sessionStore';

/** QR refresh interval (~20 seconds, matching WhatsApp's refresh cycle). */
const QR_REFRESH_SECONDS = 20;

/** User-facing messages — diagnostic detail goes to the (sanitized) log only. */
const MSG_SESSION_EXPIRED = 'Session expired. Please reconnect.';
const MSG_COULD_NOT_START = 'WhatsApp integration could not start.';

/**
 * Maximum time `listPrivateChats` waits for the initial history sync to
 * deliver chats before returning whatever is available. WhatsApp streams
 * history in chunks after connection; without a brief wait the first call
 * could return an empty list (research: Baileys history sync is async).
 */
const HISTORY_SYNC_WAIT_MS = 8_000;

/** Poll interval while waiting for the first chats to arrive. */
const HISTORY_POLL_MS = 250;

/** Reconnect backoff after a QR-phase / transient disconnect. */
const RECONNECT_DELAY_MS = 1_000;

/** Minimal structural logger so this module does not depend on Fastify. */
export interface AdapterLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/** A message reduced to the fields the chat-list preview needs. */
interface LastMessageInfo {
  timestamp: number;
  type: string;
  body: string;
}

/**
 * The lean, JSON-safe chat record written to {@link storeFilePath}. Only the
 * fields {@link listPrivateChats} actually needs are persisted — no embedded
 * `messages` array, no protobuf metadata, and `timestamp` is already a plain
 * number so it survives the JSON round-trip (no `Long` objects to rehydrate).
 */
interface PersistedChat {
  id: string;
  name: string | null;
  /** Activity time in Unix seconds, or `null` when the source reported none. */
  timestamp: number | null;
}

/** The lean, JSON-safe contact record written to {@link storeFilePath}. */
interface PersistedContact {
  id: string;
  name?: string;
  notify?: string;
  verifiedName?: string;
  phoneNumber?: string;
  lid?: string;
}

/** On-disk shape of the persisted store (see {@link persistStores}). */
interface PersistedStore {
  chats?: Record<string, PersistedChat>;
  contacts?: Record<string, PersistedContact>;
  lastMessages?: Record<string, LastMessageInfo>;
  /** LID JID → phone JID bridge (see {@link loadLidMappings}). */
  lidMap?: Record<string, string>;
  /** JIDs of chats that had actual messages (not just metadata). */
  activeChatIds?: string[];
}

/**
 * The real {@link WhatsAppAdapter} backed by `@whiskeysockets/baileys`.
 *
 * Baileys connects directly via WebSocket to WhatsApp servers — no Chromium
 * needed. This makes it significantly faster and lighter than a browser-based
 * adapter for fetching chats and messages.
 *
 * Library containment (Constitution IV): every Baileys value is consumed here
 * and converted to project-owned types before crossing the adapter boundary.
 *
 * Read-only by design (Constitution II): there are no send, edit, delete, or
 * any other write-operation methods toward WhatsApp.
 *
 * Data model: WhatsApp streams the account's history asynchronously after the
 * socket opens (`messaging-history.set`), and live activity arrives via
 * `messages.upsert`. This adapter maintains three in-memory indexes built from
 * those events:
 *  - {@link chatStore}: chat metadata (one entry per conversation)
 *  - {@link contactStore}: resolved contact names/numbers
 *  - {@link messagesByChat}: full messages per chat (for fetch + media)
 * plus {@link lastMessageByChat} for fast list previews.
 */
export class BaileysAdapter implements WhatsAppAdapter {
  private socket: WASocket | null = null;
  private state: ConnectionState = 'disconnected';
  private restoring = false;
  private connectedAt: string | null = null;
  private lastError: string | null = null;
  private qrListeners: Array<(qr: string, expiresIn: number) => void> = [];
  private stateListeners: Array<(state: ConnectionState, error: string | null) => void> = [];

  /** Chat metadata indexed by JID, from history sync + live upserts. */
  private chatStore = new Map<string, Chat>();
  /** Resolved contact identity indexed by JID. */
  private contactStore = new Map<string, Contact>();
  /** Full messages per chat JID, deduplicated by message id. */
  private messagesByChat = new Map<string, Map<string, WAMessage>>();
  /** Fast last-message preview index per chat JID. */
  private lastMessageByChat = new Map<string, LastMessageInfo>();

  /**
   * Bridges a privacy LID JID (`<lid>@lid`) to its phone JID
   * (`<msisdn>@s.whatsapp.net`). WhatsApp keys chats by LID but stores contact
   * identity under the phone JID, so this map is what lets a `@lid` chat
   * resolve a saved name and number. Built from the Baileys `lid-mapping-*`
   * auth files and kept current from live `lid-mapping.update` events.
   */
  private lidToPhoneJid = new Map<string, string>();

  /** Whether WhatsApp has signalled the initial history sync is complete. */
  private historySyncComplete = false;

  constructor(private readonly logger?: AdapterLogger) {}

  // --- Lifecycle ---

  async initialize(): Promise<void> {
    if (this.socket !== null) {
      return;
    }

    const hadSession = await sessionStore.sessionExists();
    this.restoring = hadSession;
    this.lastError = null;
    this.historySyncComplete = false;
    this.setState('initializing');

    try {
      await sessionStore.ensureSessionDir();
      const { state: authState, saveCreds } = await useMultiFileAuthState(baileysSessionPath());

      const socket = makeWASocket({
        auth: authState,
        printQRInTerminal: false,
        logger: this.createBaileysLogger(),
        connectTimeoutMs: 60_000,
        // Only sync recent/visible chats — not the full account history.
        // With syncFullHistory enabled, WhatsApp streams metadata and messages
        // for every conversation ever had (potentially thousands), whereas the
        // user only needs the currently active chats visible in their main list.
        syncFullHistory: false,
        markOnlineOnConnect: false,
        browser: ['ChatFrame', 'Desktop', '1.0.0'],
      });

      this.socket = socket;
      this.registerEventHandlers(socket, saveCreds, hadSession);
    } catch (error) {
      this.logger?.error({ details: error }, 'baileys adapter failed to initialize');
      this.restoring = false;
      this.setState('connection_failed', MSG_COULD_NOT_START);
    }
  }

  async logout(): Promise<void> {
    this.connectedAt = null;
    this.lastError = null;
    if (this.socket !== null) {
      try {
        await this.socket.logout();
      } catch (error) {
        this.logger?.warn({ details: error }, 'baileys logout reported an error');
      }
      this.teardownSocket();
    }
    this.clearStores();
    this.setState('disconnected');
  }

  async destroy(): Promise<void> {
    this.teardownSocket();
    this.qrListeners = [];
    this.stateListeners = [];
    this.clearStores();
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
    this.requireSocket();

    // History arrives asynchronously after connect; give it a brief window to
    // populate so the first call doesn't return an empty list (SC: usable
    // picker without a manual refresh).
    await this.waitForHistory();

    const rawChats: RawChatInfo[] = [];

    for (const [jid, chat] of this.chatStore) {
      if (!isPrivateChatJid(jid)) continue;

      // Only show chats visible in the user's WhatsApp main list — exclude
      // archived conversations (they are hidden in WhatsApp's UI too).
      const chatRecord = chat as Record<string, unknown>;
      if (chatRecord.archive === true || chatRecord.archived === true) continue;

      // A chat must have actual messages delivered in this session to be
      // considered "currently active". WhatsApp's history sync streams metadata
      // for ALL historical conversations but only delivers message payloads for
      // the recent/visible subset. Chats that only have metadata (no messages
      // in our store) correspond to old conversations the user no longer sees
      // in their WhatsApp main list.
      const hasMessages = this.messagesByChat.has(jid) && this.messagesByChat.get(jid)!.size > 0;
      if (!hasMessages) continue;

      const last = this.lastMessageByChat.get(jid);
      const phoneNumber = phoneFromJid(jid) ?? this.resolvePhoneFromContact(jid);
      const resolvedName = this.resolveDisplayName(jid, chat);

      // Ensure we always have either a name or a phone number to display.
      // Only extract from phone-based JIDs (@s.whatsapp.net) — NEVER from
      // @lid JIDs whose user part is an opaque privacy ID, not an MSISDN
      // (Constitution XII).
      let finalPhone = phoneNumber;
      if (resolvedName === null && finalPhone === null && !jid.endsWith(LID_JID_SUFFIX)) {
        const userPart = jid.split('@')[0] ?? '';
        if (/^\d+$/.test(userPart)) {
          finalPhone = userPart;
        }
      }

      const raw: RawChatInfo = {
        id: jid,
        name: resolvedName,
        isGroup: false,
        user: finalPhone,
        timestamp: last?.timestamp ?? this.resolveChatTimestamp(chat),
        lastMessage: last ? { type: last.type, body: last.body } : null,
      };

      // FR-021: a conversation with no history has nothing to archive.
      if (!isEmptyChat(raw)) {
        rawChats.push(raw);
      }
    }

    const summaries = rawChats.map(toChatSummary);
    return ChatSummarySchema.array().parse(summaries);
  }

  async *fetchMessages(
    chatId: string,
    options: FetchMessagesOptions,
  ): AsyncIterable<RawWhatsAppMessage> {
    this.requireSocket();

    const limit = options.limit ?? Number.MAX_SAFE_INTEGER;
    const before = options.before !== undefined ? Date.parse(options.before) / 1000 : undefined;
    const after = options.after !== undefined ? Date.parse(options.after) / 1000 : undefined;

    // Resolve the conversation partner once so received messages carry the
    // real name/number rather than the opaque JID user part (FR-004).
    const senderName = this.resolveDisplayName(chatId, this.chatStore.get(chatId)) ?? undefined;
    const senderPhone = phoneFromJid(chatId) ?? undefined;

    // Snapshot the chat's messages in chronological (oldest-first) order so
    // the pipeline receives a deterministic stream (Constitution IX).
    const stored = this.messagesByChat.get(chatId);
    const ordered = stored
      ? [...stored.values()].sort(
          (a, b) => (toUnixSeconds(a.messageTimestamp) ?? 0) - (toUnixSeconds(b.messageTimestamp) ?? 0),
        )
      : [];

    let yielded = 0;
    for (const message of ordered) {
      if (yielded >= limit) break;

      const ts = toUnixSeconds(message.messageTimestamp);
      if (before !== undefined && ts !== undefined && ts >= before) continue;
      if (after !== undefined && ts !== undefined && ts <= after) continue;

      const raw = this.toRawMessage(chatId, message, senderName, senderPhone);
      if (raw === null) continue;

      yield raw;
      yielded += 1;
    }
  }

  async downloadImage(message: RawWhatsAppMessage): Promise<DownloadedMedia | null> {
    if (!message.hasMedia) return null;

    const stored = this.messagesByChat.get(message.chatId)?.get(message.id);
    if (stored === undefined || !stored.message) {
      this.logger?.warn({ msgId: message.id }, 'media message not in store for download');
      return null;
    }

    const resolved = resolveContentType(stored.message as Record<string, unknown>);
    if (resolved === null || !hasMediaContent(resolved.type)) return null;

    try {
      const buffer = (await downloadMediaMessage(
        stored,
        'buffer',
        {},
        {
          logger: this.createBaileysLogger(),
          reuploadRequest: this.socket!.updateMediaMessage,
        },
      )) as Buffer;

      const mimeType = resolveMimeType(resolved.content, resolved.type);
      return {
        buffer: Buffer.from(buffer),
        mimeType,
        filename: `${message.id}.${mimeToExtension(mimeType)}`,
      };
    } catch (error) {
      this.logger?.warn({ details: error }, 'media download failed');
      return null;
    }
  }

  // --- Event wiring ---

  private registerEventHandlers(
    socket: WASocket,
    saveCreds: () => Promise<void>,
    hadSession: boolean,
  ): void {
    socket.ev.on('creds.update', () => {
      void saveCreds();
    });

    socket.ev.on('connection.update', (update) => {
      this.handleConnectionUpdate(update, hadSession);
    });

    // Initial bulk history (reverse-chronological). Populates every index.
    socket.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest, progress }) => {
      this.logger?.info(
        { chats: chats.length, contacts: contacts.length, messages: messages.length, isLatest, progress },
        'messaging-history.set received',
      );
      for (const contact of contacts) this.indexContact(contact);
      for (const chat of chats) this.indexChat(chat);
      for (const message of messages) this.indexMessage(message);

      if (isLatest === true || progress === 100) {
        this.historySyncComplete = true;
      }

      // Persist to disk so subsequent session-restores have data immediately.
      void this.persistStores();
    });

    socket.ev.on('messaging-history.status', ({ status, syncType }) => {
      this.logger?.info({ status, syncType }, 'messaging-history.status received');
      if (status === 'complete' || status === 'paused') {
        this.historySyncComplete = true;
        void this.persistStores();
      }
    });

    // Live + incremental chat metadata.
    socket.ev.on('chats.upsert', (chats) => {
      this.logger?.info({ count: chats.length }, 'chats.upsert received');
      for (const chat of chats) this.indexChat(chat);
      void this.persistStores();
    });
    socket.ev.on('chats.update', (updates) => {
      for (const update of updates) {
        if (!update.id) continue;
        const existing = this.chatStore.get(update.id);
        this.chatStore.set(update.id, { ...(existing ?? {}), ...update } as Chat);
      }
    });
    socket.ev.on('chats.delete', (ids) => {
      for (const id of ids) {
        this.chatStore.delete(id);
        this.messagesByChat.delete(id);
        this.lastMessageByChat.delete(id);
      }
    });

    // Contact identity updates.
    socket.ev.on('contacts.upsert', (contacts) => {
      this.logger?.info({ count: contacts.length }, 'contacts.upsert received');
      for (const contact of contacts) this.indexContact(contact);
      void this.persistStores();
    });
    socket.ev.on('contacts.update', (updates) => {
      for (const update of updates) {
        if (!update.id) continue;
        const existing = this.contactStore.get(update.id);
        this.contactStore.set(update.id, { ...(existing ?? { id: update.id }), ...update });
      }
    });

    // LID → phone number mappings (resolves @lid JIDs to real numbers). These
    // arrive live for JIDs seen this session and complement the bulk load from
    // the lid-mapping files (loadLidMappings).
    socket.ev.on('lid-mapping.update' as 'contacts.update', (mapping: unknown) => {
      const m = mapping as { lid?: string; phoneNumber?: string } | undefined;
      if (m?.lid && m?.phoneNumber) {
        this.indexLidMapping(m.lid, m.phoneNumber);
      }
    });

    // Live messages (and on-demand history fetches).
    socket.ev.on('messages.upsert', ({ messages }) => {
      for (const message of messages) this.indexMessage(message);
    });
  }

  // --- Index builders (Baileys shapes → internal stores) ---

  private indexChat(chat: Chat): void {
    if (!chat.id) return;
    const existing = this.chatStore.get(chat.id);
    this.chatStore.set(chat.id, existing ? { ...existing, ...chat } : chat);
  }

  private indexContact(contact: Contact): void {
    if (!contact.id) return;
    const existing = this.contactStore.get(contact.id);
    this.contactStore.set(contact.id, existing ? { ...existing, ...contact } : contact);
  }

  /**
   * Records a single LID ↔ phone pair in the {@link lidToPhoneJid} bridge.
   * Both inputs may arrive as bare numbers or full JIDs (Baileys is
   * inconsistent), so each is normalized to its canonical JID form. Pairs that
   * don't resolve to a valid LID JID + phone number are ignored.
   */
  private indexLidMapping(lid: string, phone: string): void {
    const lidJid = lid.includes('@') ? lid : `${lid}${LID_JID_SUFFIX}`;
    if (!lidJid.endsWith(LID_JID_SUFFIX)) return;

    const phoneDigits = phone.includes('@') ? phoneFromJid(phone) : phone;
    if (phoneDigits === null || !/^\d+$/.test(phoneDigits)) return;

    this.lidToPhoneJid.set(lidJid, `${phoneDigits}${USER_JID_SUFFIX}`);
  }

  private indexMessage(message: WAMessage): void {
    const jid = message.key?.remoteJid;
    const id = message.key?.id;
    if (!jid || !id || !message.message) return;
    // Only retain one-to-one chat messages; groups/status are out of scope.
    if (!isPrivateChatJid(jid)) return;

    let bucket = this.messagesByChat.get(jid);
    if (bucket === undefined) {
      bucket = new Map<string, WAMessage>();
      this.messagesByChat.set(jid, bucket);
    }
    bucket.set(id, message);

    // Capture the contact's push name from received messages — often the only
    // place a one-to-one partner's display name is available. Update when no
    // name exists yet, or when the existing name is just the id (no real name).
    if (message.key.fromMe !== true && typeof message.pushName === 'string' && message.pushName) {
      const existing = this.contactStore.get(jid);
      if (
        existing === undefined ||
        (!existing.name && !existing.notify && !existing.verifiedName)
      ) {
        this.contactStore.set(jid, { ...(existing ?? { id: jid }), notify: message.pushName });
      }
    }

    // Maintain the fast last-message preview index.
    const ts = toUnixSeconds(message.messageTimestamp);
    if (ts !== undefined) {
      const current = this.lastMessageByChat.get(jid);
      if (current === undefined || ts >= current.timestamp) {
        const resolved = resolveContentType(message.message as Record<string, unknown>);
        if (resolved !== null) {
          this.lastMessageByChat.set(jid, {
            timestamp: ts,
            type: mapToSimpleType(resolved.type),
            body: extractBody(resolved.content, resolved.type),
          });
        }
      }
    }
  }

  // --- Name / timestamp resolution ---

  /**
   * Maps a `@lid` JID to its phone JID (`<msisdn>@s.whatsapp.net`) via the
   * {@link lidToPhoneJid} bridge, returning `null` for non-LID JIDs or when no
   * mapping exists. WhatsApp keys chats by LID but stores contact identity
   * under the phone JID, so this is the hop every LID lookup must take first.
   */
  private phoneJidForLid(jid: string): string | null {
    if (!jid.endsWith(LID_JID_SUFFIX)) return null;
    return this.lidToPhoneJid.get(jid) ?? null;
  }

  /**
   * Resolves the best display name for a one-to-one chat: the contact name
   * saved in the user's address book first, then the partner's public push
   * name, then the chat's own name, then any push name captured from messages,
   * else `null` (the UI falls back to the phone number).
   *
   * For `@lid` chats the contact record lives under the phone JID, so we look
   * up the contact through the {@link lidToPhoneJid} bridge (and still consult
   * the LID-keyed contact, in case a live event stored identity there).
   *
   * Phase 10 hardening: also scans the chat's message store for the most
   * recent pushName when all contact store lookups fail. This handles the
   * common case where `syncFullHistory: false` doesn't deliver contact records
   * but messages in the history DO carry the sender's push name.
   */
  private resolveDisplayName(jid: string, chat: Chat | undefined): string | null {
    const contact = this.contactStore.get(jid);
    const phoneJid = this.phoneJidForLid(jid);
    const phoneContact = phoneJid !== null ? this.contactStore.get(phoneJid) : undefined;
    const candidates = [
      contact?.name,
      phoneContact?.name,
      contact?.notify,
      phoneContact?.notify,
      contact?.verifiedName,
      phoneContact?.verifiedName,
      (chat as Record<string, unknown> | undefined)?.name as string | undefined,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    // Last resort: scan this chat's stored messages for a pushName on a
    // received (non-fromMe) message. This handles history-sync scenarios where
    // Baileys doesn't deliver contact records but messages carry pushName.
    const messages = this.messagesByChat.get(jid);
    if (messages !== undefined) {
      // Check the most recent messages first (they have the most current name).
      let bestPushName: string | undefined;
      let bestTs = 0;
      for (const msg of messages.values()) {
        if (msg.key?.fromMe === true) continue;
        if (typeof msg.pushName === 'string' && msg.pushName.trim().length > 0) {
          const ts = toUnixSeconds(msg.messageTimestamp) ?? 0;
          if (ts >= bestTs) {
            bestTs = ts;
            bestPushName = msg.pushName.trim();
          }
        }
      }
      if (bestPushName !== undefined) {
        // Cache it in the contact store so subsequent lookups are fast.
        const existing = this.contactStore.get(jid);
        if (existing === undefined || (!existing.name && !existing.notify)) {
          this.contactStore.set(jid, { ...(existing ?? { id: jid }), notify: bestPushName });
        }
        return bestPushName;
      }
    }

    return null;
  }

  /**
   * Resolves a chat's activity timestamp (Unix seconds) from chat metadata.
   *
   * History-sync chat entries frequently omit `conversationTimestamp` and carry
   * the activity time only inside their embedded `messages` array (the last
   * message stub). We therefore fall back to the newest embedded message
   * timestamp so those chats still get a sort key and survive the empty-chat
   * filter (otherwise ~all `@lid` history chats would be dropped).
   */
  private resolveChatTimestamp(chat: Chat): number | null {
    const record = chat as Record<string, unknown>;
    const direct =
      toUnixSeconds(record.conversationTimestamp) ?? toUnixSeconds(record.lastMessageRecvTimestamp);
    if (direct !== undefined) return direct;

    const messages = record.messages;
    if (Array.isArray(messages)) {
      let newest: number | undefined;
      for (const entry of messages) {
        const ts = toUnixSeconds(
          (entry as { message?: { messageTimestamp?: unknown } } | undefined)?.message
            ?.messageTimestamp,
        );
        if (ts !== undefined && (newest === undefined || ts > newest)) newest = ts;
      }
      if (newest !== undefined) return newest;
    }
    return null;
  }

  /**
   * Resolves the bare phone-number digits (MSISDN) for a `@lid` JID. The
   * primary source is the {@link lidToPhoneJid} bridge, whose value is a phone
   * JID we strip back to digits. As a fallback we honour a `phoneNumber` stored
   * on the contact (which Baileys may record either as bare digits or as a
   * full phone JID). Returns `null` when no number can be determined.
   */
  private resolvePhoneFromContact(jid: string): string | null {
    const mappedPhoneJid = this.phoneJidForLid(jid);
    if (mappedPhoneJid !== null) {
      const digits = phoneFromJid(mappedPhoneJid);
      if (digits !== null) return digits;
    }

    // Fallback: a `phoneNumber` recorded on the contact (from live events).
    // Baileys stores this inconsistently — sometimes bare digits, sometimes a
    // full `<digits>@s.whatsapp.net` JID — so normalize both forms.
    const contact = this.contactStore.get(jid);
    const raw = (contact as Record<string, unknown> | undefined)?.phoneNumber;
    if (typeof raw === 'string') {
      if (/^\d+$/.test(raw)) return raw;
      const digits = phoneFromJid(raw);
      if (digits !== null) return digits;
    }
    return null;
  }

  /** Converts a stored Baileys message into the project-owned raw shape. */
  private toRawMessage(
    chatId: string,
    message: WAMessage,
    senderName: string | undefined,
    senderPhone: string | undefined,
  ): RawWhatsAppMessage | null {
    const id = message.key?.id;
    if (!id || !message.message) return null;

    const resolved = resolveContentType(message.message as Record<string, unknown>);
    if (resolved === null) return null;

    const fromMe = message.key.fromMe === true;
    const type = mapToSimpleType(resolved.type);
    const body = extractBody(resolved.content, resolved.type);
    const hasMedia = hasMediaContent(resolved.type);

    const raw: RawWhatsAppMessage = {
      id,
      chatId,
      fromMe,
      author: fromMe ? 'me' : (message.key.participant ?? message.key.remoteJid ?? null),
      type,
      body,
      hasMedia,
    };

    const ts = toUnixSeconds(message.messageTimestamp);
    if (ts !== undefined) raw.timestamp = ts;

    // Received messages carry the partner's resolved identity.
    if (!fromMe) {
      if (senderName !== undefined) raw.senderName = senderName;
      if (senderPhone !== undefined) raw.senderPhoneNumber = senderPhone;
    }

    const quotedId = extractQuotedMessageId(resolved.content, resolved.type);
    if (quotedId !== undefined) raw.quotedMessageId = quotedId;

    if (hasMedia) {
      raw.mediaId = id;
      const caption = body;
      if (caption.length > 0) raw.caption = caption;
    }

    return raw;
  }

  // --- Connection lifecycle ---

  private handleConnectionUpdate(
    update: Partial<BaileysConnectionState>,
    hadSession: boolean,
  ): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (this.restoring) {
        // A QR during a restore attempt means the saved session is invalid.
        this.restoring = false;
        this.logger?.warn({}, 'session restore failed; QR presented instead');
        this.teardownSocket();
        void sessionStore.clearSession();
        this.setState('session_expired', MSG_SESSION_EXPIRED);
        return;
      }
      this.setState('waiting_for_qr');
      this.emitQr(qr, QR_REFRESH_SECONDS);
      this.setState('qr_ready');
    }

    if (connection === 'connecting') {
      if (this.state !== 'qr_ready' && this.state !== 'waiting_for_qr') {
        this.setState(hadSession ? 'connecting' : 'waiting_for_qr');
      }
    }

    if (connection === 'open') {
      this.restoring = false;
      this.connectedAt = new Date().toISOString();
      this.setState('connected');

      // Request app state sync to fetch contact names from the user's address
      // book. With syncFullHistory: false, Baileys doesn't automatically
      // deliver contact records — they come through app state collections
      // ('regular_low' contains contacts, 'regular_high' has chats/mutes).
      // This explicit resync ensures saved contact names are available for the
      // chat list display (Phase 10 hardening: contacts always resolved).
      void this.syncContacts();
    }

    if (connection === 'close') {
      this.handleClose(lastDisconnect?.error);
    }
  }

  private handleClose(error: Error | undefined): void {
    const statusCode = (error as { output?: { statusCode?: number } } | undefined)?.output
      ?.statusCode;
    const loggedOut = statusCode === DisconnectReason.loggedOut;

    this.connectedAt = null;
    this.restoring = false;
    this.teardownSocket();

    if (loggedOut) {
      void sessionStore.clearSession();
      this.setState('session_expired', MSG_SESSION_EXPIRED);
      return;
    }

    if (statusCode === DisconnectReason.restartRequired) {
      // Expected after pairing — Baileys requires a fresh socket.
      void this.reconnect();
      return;
    }

    if (
      this.state === 'qr_ready' ||
      this.state === 'waiting_for_qr' ||
      this.state === 'connecting' ||
      this.state === 'initializing'
    ) {
      // Closed while waiting for a scan or mid-handshake — get a fresh QR.
      void this.reconnect();
      return;
    }

    if (
      statusCode === DisconnectReason.connectionClosed ||
      statusCode === DisconnectReason.connectionLost ||
      statusCode === DisconnectReason.timedOut
    ) {
      // Lost an established connection — attempt one transparent reconnect.
      void this.reconnect();
      return;
    }

    this.setState('disconnected');
  }

  /** Re-creates the socket after a transient close (fresh QR or reconnect). */
  private async reconnect(): Promise<void> {
    this.teardownSocket();
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    try {
      await this.initialize();
    } catch (error) {
      this.logger?.error({ details: error }, 'reconnect failed');
      this.setState('connection_failed', MSG_COULD_NOT_START);
    }
  }

  // --- Helpers ---

  /**
   * Resolves once chats are available: first checks the in-memory store, then
   * attempts to load from the persisted store, then waits briefly for the
   * history sync events to arrive.
   */
  private async waitForHistory(): Promise<void> {
    // The LID → phone bridge must be ready before any name/number resolution,
    // regardless of where the chats themselves come from. Build it from the
    // Baileys auth files when empty (live `lid-mapping.update` events only
    // cover JIDs seen this session, so the files are the authoritative source).
    if (this.lidToPhoneJid.size === 0) {
      await this.loadLidMappings();
    }

    // Already have chats in memory from this session's sync events.
    if (this.chatStore.size > 0) return;

    // Try loading from the persisted store (covers session-restore case where
    // WhatsApp doesn't re-send history).
    const loaded = await this.loadPersistedStores();
    if (loaded) return;

    // Wait for the live sync to deliver chats.
    const deadline = Date.now() + HISTORY_SYNC_WAIT_MS;
    while (Date.now() < deadline) {
      if (this.chatStore.size > 0 || this.historySyncComplete) return;
      await new Promise((resolve) => setTimeout(resolve, HISTORY_POLL_MS));
    }
  }

  private teardownSocket(): void {
    if (this.socket !== null) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.end(undefined);
      } catch {
        // Teardown is best-effort; a throwing socket must not block cleanup.
      }
      this.socket = null;
    }
  }

  private clearStores(): void {
    this.chatStore.clear();
    this.contactStore.clear();
    this.messagesByChat.clear();
    this.lastMessageByChat.clear();
    this.lidToPhoneJid.clear();
    this.historySyncComplete = false;
  }

  /**
   * Requests contact names from the user's address book via app state sync.
   *
   * WhatsApp stores saved contact names (the names you assign to numbers in
   * your phone) in the 'regular_low' app state collection. When
   * `syncFullHistory` is false, Baileys doesn't automatically sync this
   * collection — it only delivers chat metadata and recent messages. This
   * method explicitly requests the sync after connection, which fires
   * `contacts.upsert` events with the saved address book names.
   *
   * This is the key to showing "Ahmed Mohammed" instead of "+971501234567"
   * for contacts the user has saved in their phone.
   *
   * Never throws — contact sync is best-effort and must not break the
   * connection lifecycle.
   */
  private async syncContacts(): Promise<void> {
    if (this.socket === null) return;
    try {
      // 'regular_low' contains contacts from the phone's address book.
      // 'regular_high' contains chat metadata (mutes, pins, archives).
      // Both are needed for a complete view, but contacts are the priority.
      await this.socket.resyncAppState(['regular_low', 'regular_high'], false);
      this.logger?.info({}, 'app state contact sync completed');
      // Persist the newly received contacts so session restores have them.
      void this.persistStores();
    } catch (error) {
      // Non-fatal: the chat list still works with phone numbers as fallback.
      this.logger?.warn({ details: error }, 'app state contact sync failed (non-fatal)');
    }
  }

  /**
   * Persists the chat/contact/last-message indexes to disk for fast restore.
   *
   * Crucially, the data is *normalized before* writing: `Long` timestamps are
   * collapsed to plain numbers and only the listing-relevant fields are kept.
   * This keeps the file lean (no embedded `messages` arrays, no protobuf
   * metadata) and — more importantly — avoids serializing `Long` objects as
   * `{ low, high, unsigned }`, which previously could not be rehydrated and so
   * dropped every chat's timestamp on restore.
   */
  private async persistStores(): Promise<void> {
    try {
      const storeFile = this.storeFilePath();
      await mkdir(dirname(storeFile), { recursive: true });

      const chats: Record<string, PersistedChat> = {};
      for (const [id, chat] of this.chatStore) {
        chats[id] = {
          id,
          name: this.resolveDisplayName(id, chat),
          timestamp: this.resolveChatTimestamp(chat),
        };
      }

      const contacts: Record<string, PersistedContact> = {};
      for (const [id, contact] of this.contactStore) {
        const record = contact as unknown as Record<string, unknown>;
        const lean: PersistedContact = { id };
        if (contact.name) lean.name = contact.name;
        if (contact.notify) lean.notify = contact.notify;
        if (contact.verifiedName) lean.verifiedName = contact.verifiedName;
        if (typeof record.phoneNumber === 'string') lean.phoneNumber = record.phoneNumber;
        if (typeof record.lid === 'string') lean.lid = record.lid;
        contacts[id] = lean;
      }

      const data: PersistedStore = {
        chats,
        contacts,
        lastMessages: Object.fromEntries(this.lastMessageByChat),
        // Persist the LID bridge so a restore can resolve names/numbers without
        // re-reading hundreds of individual lid-mapping files.
        lidMap: Object.fromEntries(this.lidToPhoneJid),
        // Track which chats had actual messages so restores can filter correctly.
        activeChatIds: [...this.messagesByChat.entries()]
          .filter(([, msgs]) => msgs.size > 0)
          .map(([id]) => id),
      };
      await writeFile(storeFile, JSON.stringify(data), 'utf8');
    } catch (error) {
      this.logger?.warn({ details: error }, 'failed to persist chat store');
    }
  }

  /**
   * Loads the persisted indexes from disk into memory (session-restore case,
   * where WhatsApp does not re-send history). Tolerates both the lean shape
   * written by {@link persistStores} and any legacy file that stored raw
   * `Chat` objects — {@link toUnixSeconds} understands JSON-serialized `Long`
   * timestamps in either form. Returns `true` when any chat was loaded.
   */
  private async loadPersistedStores(): Promise<boolean> {
    try {
      const raw = await readFile(this.storeFilePath(), 'utf8');
      const data = JSON.parse(raw) as PersistedStore;

      if (data.chats) {
        for (const [id, persisted] of Object.entries(data.chats)) {
          // Reconstruct a minimal Chat-shaped record. `resolveChatTimestamp`
          // reads `conversationTimestamp`, so map the normalized number back
          // onto it; `name` feeds `resolveDisplayName`'s chat-name fallback.
          // Tolerate a legacy file that stored the raw Chat: run the original
          // record through resolveChatTimestamp so its `conversationTimestamp`
          // (a JSON-serialized Long) or embedded `messages` stub still yields a
          // timestamp. The lean `timestamp` field, when present, wins.
          const legacy = persisted as unknown as Chat;
          const timestamp = persisted.timestamp ?? this.resolveChatTimestamp(legacy);
          const chat = {
            id,
            name: persisted.name ?? (legacy as { name?: string }).name,
            conversationTimestamp: timestamp ?? undefined,
          } as unknown as Chat;
          this.chatStore.set(id, chat);
        }
      }
      if (data.contacts) {
        for (const [id, contact] of Object.entries(data.contacts)) {
          this.contactStore.set(id, contact as unknown as Contact);
        }
      }
      if (data.lastMessages) {
        for (const [id, info] of Object.entries(data.lastMessages)) {
          this.lastMessageByChat.set(id, info);
        }
      }
      if (data.lidMap) {
        for (const [lidJid, phoneJid] of Object.entries(data.lidMap)) {
          this.lidToPhoneJid.set(lidJid, phoneJid);
        }
      }
      // Restore active chat markers so the "has messages" filter works after a
      // session restore (messagesByChat itself is not persisted, but we track
      // which chats had messages via a sentinel entry).
      if (data.activeChatIds) {
        for (const id of data.activeChatIds) {
          if (!this.messagesByChat.has(id)) {
            const sentinel = new Map<string, WAMessage>();
            sentinel.set('__persisted__', {} as WAMessage);
            this.messagesByChat.set(id, sentinel);
          }
        }
      }

      return this.chatStore.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Builds the {@link lidToPhoneJid} bridge from the Baileys auth directory.
   *
   * Baileys persists each LID ↔ phone pair as a small file pair; the
   * `lid-mapping-<lid>_reverse.json` variant holds the phone number for a given
   * LID, which is exactly the direction we need (chats are keyed by LID, names
   * by phone JID). Files are read in bulk for speed and the loader never throws:
   * a missing directory or an unreadable/corrupt file is skipped, not fatal.
   */
  private async loadLidMappings(): Promise<void> {
    const dir = baileysSessionPath();
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      this.logger?.warn({ details: error }, 'could not read lid-mapping directory');
      return;
    }

    const files = entries.filter(isLidMappingFile);
    const results = await Promise.all(
      files.map(async (name) => {
        try {
          const raw = await readFile(join(dir, name), 'utf8');
          return parseLidMappingFile(name, raw);
        } catch (error) {
          this.logger?.warn({ file: name, details: error }, 'skipped unreadable lid-mapping file');
          return null;
        }
      }),
    );

    let loaded = 0;
    for (const pair of results) {
      if (pair === null) continue;
      this.lidToPhoneJid.set(pair[0], pair[1]);
      loaded += 1;
    }
    this.logger?.info({ count: loaded }, 'lid mappings loaded');
  }

  private storeFilePath(): string {
    return join(baileysSessionPath(), 'chatframe-store.json');
  }

  private requireSocket(): WASocket {
    if (this.socket === null || this.state !== 'connected') {
      throw new WhatsAppNotConnectedError();
    }
    return this.socket;
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

  /**
   * Creates a pino-compatible silent logger for Baileys internals. Only errors
   * are forwarded to the adapter's own (sanitized) logger.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createBaileysLogger(): any {
    const noop = () => {};
    const baileysLogger: Record<string, unknown> = {
      level: 'silent',
      info: noop,
      warn: noop,
      // Arrow function so `this` stays bound to the adapter instance.
      error: (obj: unknown, msg?: string) => {
        this.logger?.error(obj, msg ?? 'baileys internal error');
      },
      debug: noop,
      trace: noop,
      fatal: noop,
      child() {
        return baileysLogger;
      },
    };
    return baileysLogger;
  }
}

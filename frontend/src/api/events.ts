import {
  SessionStatusSchema,
  SseSessionQrEventSchema,
  SseSessionStateEventSchema,
  type SessionStatus,
  type SseSessionQrEvent,
  type SseSessionStateEvent,
} from '@chatframe/shared';
import { getJson } from './client';
import { useSessionStore, type ChannelStatus } from '../stores/useSessionStore';

/**
 * SSE client for `GET /api/events` (FR-011, FR-022; research §6). Parses
 * `session.state` and `session.qr` events, dispatches them to the session
 * store, and self-heals: reconnect with exponential backoff (1s, 2s, 4s),
 * and after 3 consecutive failures fall back to polling
 * `GET /api/session/status` every 5s while SSE retries continue in the
 * background. Polling stops as soon as SSE recovers.
 */

const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3714';

export const BACKOFF_MS = [1_000, 2_000, 4_000] as const;
export const POLL_INTERVAL_MS = 5_000;
export const FAILURES_BEFORE_POLLING = 3;

/** The subset of `EventSource` this client needs (injectable for tests). */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
}

export interface SessionEventsOptions {
  url?: string;
  /** EventSource factory — injectable because jsdom has no EventSource. */
  createEventSource?: (url: string) => EventSourceLike;
  /** Status poller used during the fallback (defaults to the real endpoint). */
  pollStatus?: () => Promise<SessionStatus>;
  onState: (event: SseSessionStateEvent) => void;
  onQr: (event: SseSessionQrEvent) => void;
  onStatus: (status: SessionStatus) => void;
  onChannelChange?: (channel: ChannelStatus) => void;
}

async function fetchStatus(): Promise<SessionStatus> {
  return SessionStatusSchema.parse(await getJson('/api/session/status'));
}

export class SessionEventsClient {
  private source: EventSourceLike | null = null;
  private failures = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = true;

  constructor(private readonly options: SessionEventsOptions) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.closeSource();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPolling();
    this.options.onChannelChange?.('idle');
  }

  private connect(): void {
    if (this.stopped) return;
    const url = this.options.url ?? `${BASE_URL}/api/events`;
    const factory = this.options.createEventSource ?? ((target: string) => new EventSource(target));

    let source: EventSourceLike;
    try {
      source = factory(url);
    } catch {
      this.handleFailure();
      return;
    }
    this.source = source;

    source.addEventListener('open', () => {
      this.failures = 0;
      this.stopPolling();
      this.options.onChannelChange?.('open');
    });
    source.addEventListener('session.state', (event) => {
      this.dispatch(event, (data) => this.options.onState(SseSessionStateEventSchema.parse(data)));
    });
    source.addEventListener('session.qr', (event) => {
      this.dispatch(event, (data) => this.options.onQr(SseSessionQrEventSchema.parse(data)));
    });
    source.addEventListener('error', () => {
      this.handleFailure();
    });
  }

  private dispatch(event: MessageEvent, handler: (data: unknown) => void): void {
    try {
      handler(JSON.parse(String(event.data)));
    } catch {
      // A malformed event must not kill the stream; the next event recovers.
    }
  }

  private handleFailure(): void {
    this.closeSource();
    if (this.stopped) return;

    const delay = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)] ?? 4_000;
    this.failures += 1;

    if (this.failures >= FAILURES_BEFORE_POLLING) {
      this.startPolling();
      this.options.onChannelChange?.('polling');
    } else {
      this.options.onChannelChange?.('reconnecting');
    }

    // SSE retries continue in the background even while polling (FR-022).
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    const poll = this.options.pollStatus ?? fetchStatus;
    this.pollTimer = setInterval(() => {
      void poll()
        .then((status) => {
          this.options.onStatus(status);
        })
        .catch(() => {
          // Backend unreachable; keep polling until it recovers.
        });
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private closeSource(): void {
    this.source?.close();
    this.source = null;
  }
}

/** Creates a client wired to {@link useSessionStore} (used by ConnectPage). */
export function createSessionEventsClient(): SessionEventsClient {
  const store = useSessionStore.getState();
  return new SessionEventsClient({
    onState: store.applyStateEvent,
    onQr: store.applyQrEvent,
    onStatus: store.applyStatus,
    onChannelChange: store.setChannel,
  });
}

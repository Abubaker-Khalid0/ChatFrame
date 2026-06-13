import { create } from 'zustand';
import type {
  ConnectionState,
  SessionStatus,
  SseSessionQrEvent,
  SseSessionStateEvent,
} from '@chatframe/shared';

/** Health of the browser↔backend event channel (FR-022). */
export type ChannelStatus = 'idle' | 'open' | 'reconnecting' | 'polling';

interface SessionStoreState {
  /** Current connection lifecycle state, mirrored from the backend. */
  state: ConnectionState;
  /** User-friendly error for failed states, or `null`. */
  error: string | null;
  /** Latest QR payload from a `session.qr` event, or `null`. */
  qr: string | null;
  /** Seconds until the current QR refreshes (drives the countdown, FR-021). */
  qrExpiresIn: number | null;
  /** Chromium health from the status endpoint; `null` until first check. */
  healthAvailable: boolean | null;
  /** Whether a silent session restore is in progress (FR-008). */
  isRestoring: boolean;
  /** SSE channel health, shown as a "Reconnecting…" indicator (FR-022). */
  channel: ChannelStatus;

  applyStateEvent(event: SseSessionStateEvent): void;
  applyQrEvent(event: SseSessionQrEvent): void;
  applyStatus(status: SessionStatus): void;
  setChannel(channel: ChannelStatus): void;
  reset(): void;
}

const initialState = {
  state: 'disconnected' as ConnectionState,
  error: null,
  qr: null,
  qrExpiresIn: null,
  healthAvailable: null,
  isRestoring: false,
  channel: 'idle' as ChannelStatus,
};

/** True while the QR (if any) is still relevant for the given state. */
function keepsQr(state: ConnectionState): boolean {
  return state === 'qr_ready' || state === 'waiting_for_qr';
}

/**
 * Session connection state shared across the connect screen (FR-016). Fed by
 * the SSE client (`api/events.ts`) and the status endpoint; components only
 * read from here, so every tab converges on the same view (FR-023).
 */
export const useSessionStore = create<SessionStoreState>((set) => ({
  ...initialState,

  applyStateEvent: (event) =>
    set((current) => ({
      state: event.state,
      error: event.error,
      qr: keepsQr(event.state) ? current.qr : null,
      qrExpiresIn: keepsQr(event.state) ? current.qrExpiresIn : null,
    })),

  applyQrEvent: (event) => set({ qr: event.qr, qrExpiresIn: event.expiresIn }),

  applyStatus: (status) =>
    set((current) => ({
      state: status.state,
      error: status.error,
      isRestoring: status.isRestoring,
      healthAvailable: status.healthCheck.available,
      qr: keepsQr(status.state) ? current.qr : null,
      qrExpiresIn: keepsQr(status.state) ? current.qrExpiresIn : null,
    })),

  setChannel: (channel) => set({ channel }),

  reset: () => set(initialState),
}));

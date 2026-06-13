import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionStatus } from '@chatframe/shared';
import {
  BACKOFF_MS,
  FAILURES_BEFORE_POLLING,
  POLL_INTERVAL_MS,
  SessionEventsClient,
  type EventSourceLike,
  type SessionEventsOptions,
} from './events';
import type { ChannelStatus } from '../stores/useSessionStore';

/** A controllable stand-in for EventSource (jsdom has none). */
class FakeEventSource implements EventSourceLike {
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  closed = false;

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data?: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data }));
    }
  }
}

const CONNECTED_STATUS: SessionStatus = {
  state: 'connected',
  isRestoring: false,
  healthCheck: { available: true, checkedAt: '2026-06-11T10:00:00.000Z', error: null },
  connectedAt: '2026-06-11T10:00:15.000Z',
  error: null,
};

function makeHarness(overrides: Partial<SessionEventsOptions> = {}) {
  const sources: FakeEventSource[] = [];
  const onState = vi.fn();
  const onQr = vi.fn();
  const onStatus = vi.fn();
  const channels: ChannelStatus[] = [];
  const pollStatus = vi.fn(() => Promise.resolve(CONNECTED_STATUS));

  const client = new SessionEventsClient({
    url: 'http://test/api/events',
    createEventSource: () => {
      const source = new FakeEventSource();
      sources.push(source);
      return source;
    },
    pollStatus,
    onState,
    onQr,
    onStatus,
    onChannelChange: (channel) => channels.push(channel),
    ...overrides,
  });

  return { client, sources, onState, onQr, onStatus, pollStatus, channels };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionEventsClient (FR-011, FR-022)', () => {
  it('parses session.state and session.qr events and dispatches them', () => {
    const h = makeHarness();
    h.client.start();
    const source = h.sources[0]!;
    source.emit('open');

    source.emit('session.state', JSON.stringify({ state: 'qr_ready', error: null }));
    expect(h.onState).toHaveBeenCalledWith({ state: 'qr_ready', error: null });

    source.emit('session.qr', JSON.stringify({ qr: 'mock-qr', expiresIn: 20 }));
    expect(h.onQr).toHaveBeenCalledWith({ qr: 'mock-qr', expiresIn: 20 });

    expect(h.channels).toEqual(['open']);
    h.client.stop();
  });

  it('survives a malformed event and keeps the stream alive', () => {
    const h = makeHarness();
    h.client.start();
    const source = h.sources[0]!;
    source.emit('open');

    source.emit('session.state', 'not-json');
    source.emit('session.state', JSON.stringify({ state: 'nonsense', error: null }));
    expect(h.onState).not.toHaveBeenCalled();

    source.emit('session.state', JSON.stringify({ state: 'connected', error: null }));
    expect(h.onState).toHaveBeenCalledWith({ state: 'connected', error: null });
    h.client.stop();
  });

  it('reconnects with exponential backoff (1s, 2s, 4s)', () => {
    const h = makeHarness();
    h.client.start();
    expect(h.sources).toHaveLength(1);

    // 1st failure → retry after 1s.
    h.sources[0]!.emit('error');
    expect(h.channels.at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(BACKOFF_MS[0] - 1);
    expect(h.sources).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(h.sources).toHaveLength(2);

    // 2nd failure → retry after 2s.
    h.sources[1]!.emit('error');
    vi.advanceTimersByTime(BACKOFF_MS[1]);
    expect(h.sources).toHaveLength(3);

    // 3rd failure → retry after 4s (and polling kicks in, tested below).
    h.sources[2]!.emit('error');
    vi.advanceTimersByTime(BACKOFF_MS[2]);
    expect(h.sources).toHaveLength(4);
    h.client.stop();
  });

  it(`falls back to polling after ${FAILURES_BEFORE_POLLING} consecutive failures while SSE retries continue`, async () => {
    const h = makeHarness();
    h.client.start();

    for (let i = 0; i < FAILURES_BEFORE_POLLING; i += 1) {
      h.sources.at(-1)!.emit('error');
      await vi.advanceTimersByTimeAsync(BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)]!);
    }
    expect(h.channels.at(-1)).toBe('polling');

    // Polling hits the status endpoint every 5s and feeds the store.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(h.pollStatus).toHaveBeenCalledTimes(1);
    expect(h.onStatus).toHaveBeenCalledWith(CONNECTED_STATUS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(h.pollStatus).toHaveBeenCalledTimes(2);

    // SSE retries kept running in the background (a new source exists).
    expect(h.sources.length).toBeGreaterThan(FAILURES_BEFORE_POLLING);
    h.client.stop();
  });

  it('stops polling and resets the backoff once SSE recovers', async () => {
    const h = makeHarness();
    h.client.start();

    for (let i = 0; i < FAILURES_BEFORE_POLLING; i += 1) {
      h.sources.at(-1)!.emit('error');
      await vi.advanceTimersByTimeAsync(BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)]!);
    }
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(h.pollStatus).toHaveBeenCalledTimes(1);

    // The background SSE retry succeeds → polling stops, channel is open.
    h.sources.at(-1)!.emit('open');
    expect(h.channels.at(-1)).toBe('open');
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(h.pollStatus).toHaveBeenCalledTimes(1);

    // The failure counter was reset: the next drop backs off from 1s again.
    const sourcesBefore = h.sources.length;
    h.sources.at(-1)!.emit('error');
    expect(h.channels.at(-1)).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0]);
    expect(h.sources.length).toBe(sourcesBefore + 1);
    h.client.stop();
  });

  it('stop() closes the source, cancels timers, and goes idle', async () => {
    const h = makeHarness();
    h.client.start();
    const source = h.sources[0]!;
    source.emit('error'); // schedule a reconnect

    h.client.stop();
    expect(source.closed).toBe(true);
    expect(h.channels.at(-1)).toBe('idle');

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(h.sources).toHaveLength(1); // no reconnects after stop
    expect(h.pollStatus).not.toHaveBeenCalled();
  });
});

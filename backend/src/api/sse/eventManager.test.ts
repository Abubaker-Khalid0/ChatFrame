import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventManager, HEARTBEAT_INTERVAL_MS, formatSseEvent } from './eventManager';

interface CapturedEvent {
  event: string;
  data: Record<string, unknown>;
}

function parseSse(chunk: string): CapturedEvent[] {
  const events: CapturedEvent[] = [];
  for (const block of chunk.split('\n\n')) {
    const eventMatch = /^event: (.+)$/m.exec(block);
    const dataMatch = /^data: (.+)$/m.exec(block);
    if (eventMatch?.[1] !== undefined && dataMatch?.[1] !== undefined) {
      events.push({
        event: eventMatch[1],
        data: JSON.parse(dataMatch[1]) as Record<string, unknown>,
      });
    }
  }
  return events;
}

/** A test sink that records everything written to it. */
function makeSink() {
  const received: CapturedEvent[] = [];
  return {
    received,
    sink: {
      write: (chunk: string) => {
        received.push(...parseSse(chunk));
      },
    },
  };
}

let manager: EventManager;

beforeEach(() => {
  manager = new EventManager();
});

afterEach(() => {
  manager.reset();
  vi.useRealTimers();
});

describe('EventManager (FR-011, FR-023)', () => {
  it('broadcasts a logout disconnect to every connected tab (SC-011)', () => {
    const tabA = makeSink();
    const tabB = makeSink();
    manager.addClient(tabA.sink);
    manager.addClient(tabB.sink);

    manager.broadcast('session.state', { state: 'disconnected', error: null });

    // Multi-tab convergence: both SSE clients receive the same broadcast.
    for (const tab of [tabA, tabB]) {
      expect(tab.received).toEqual([
        { event: 'session.state', data: { state: 'disconnected', error: null } },
      ]);
    }
  });

  it('stops delivering to a client after its cleanup function runs', () => {
    const tabA = makeSink();
    const tabB = makeSink();
    const removeA = manager.addClient(tabA.sink);
    manager.addClient(tabB.sink);

    removeA();
    manager.broadcast('session.state', { state: 'connected', error: null });

    expect(tabA.received).toHaveLength(0);
    expect(tabB.received).toHaveLength(1);
    expect(manager.clientCount()).toBe(1);
  });

  it('drops a dead sink without breaking the broadcast to remaining clients', () => {
    const dead = {
      write: () => {
        throw new Error('socket closed');
      },
    };
    const alive = makeSink();
    manager.addClient(dead);
    manager.addClient(alive.sink);

    manager.broadcast('session.state', { state: 'disconnected', error: null });

    expect(alive.received).toHaveLength(1);
    expect(manager.clientCount()).toBe(1);
  });

  it('sends a ping heartbeat every 30 seconds while clients are connected', () => {
    vi.useFakeTimers();
    const tab = makeSink();
    const remove = manager.addClient(tab.sink);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(tab.received).toEqual([{ event: 'ping', data: { timestamp: expect.any(String) } }]);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(tab.received).toHaveLength(2);

    // No clients → the heartbeat stops; nothing further is recorded.
    remove();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(tab.received).toHaveLength(2);
  });

  it('serializes events in the SSE wire format', () => {
    expect(formatSseEvent('session.qr', { qr: 'abc', expiresIn: 20 })).toBe(
      'event: session.qr\ndata: {"qr":"abc","expiresIn":20}\n\n',
    );
  });
});

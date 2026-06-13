/**
 * SSE event manager (FR-011, FR-023; research §4): keeps the registry of
 * connected SSE clients (browser tabs), broadcasts every event to all of
 * them, and sends a `ping` heartbeat every 30 seconds so proxies and
 * firewalls keep the connections open. Cleanup is per-client; the heartbeat
 * timer only runs while at least one client is connected.
 */

/** Event names carried on the stream (data-model.md; 007 FR-016). */
export type SseEventName =
  | 'session.state'
  | 'session.qr'
  | 'import.progress'
  | 'import.warning'
  | 'import.error'
  | 'import.completed'
  | 'ping';

/** Minimal sink an SSE client must provide (satisfied by `ServerResponse`). */
export interface SseSink {
  write(chunk: string): unknown;
}

export const HEARTBEAT_INTERVAL_MS = 30_000;

/** Serializes one event in the SSE wire format (`event:` + `data:` lines). */
export function formatSseEvent(event: SseEventName, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export class EventManager {
  private clients = new Map<number, SseSink>();
  private nextId = 1;
  private heartbeat: NodeJS.Timeout | null = null;

  /** Registers a client sink; returns its unregister (cleanup) function. */
  addClient(sink: SseSink): () => void {
    const id = this.nextId;
    this.nextId += 1;
    this.clients.set(id, sink);
    this.startHeartbeatIfNeeded();
    return () => {
      this.clients.delete(id);
      this.stopHeartbeatIfIdle();
    };
  }

  /** Sends `event`/`data` to every connected client (FR-023, SC-011). */
  broadcast(event: SseEventName, data: unknown): void {
    const payload = formatSseEvent(event, data);
    for (const [id, sink] of this.clients) {
      try {
        sink.write(payload);
      } catch {
        // A dead sink must not break the broadcast to the remaining clients.
        this.clients.delete(id);
      }
    }
    this.stopHeartbeatIfIdle();
  }

  /** Number of currently connected clients. */
  clientCount(): number {
    return this.clients.size;
  }

  /** Drops all clients and stops the heartbeat. Intended for tests/shutdown. */
  reset(): void {
    this.clients.clear();
    this.stopHeartbeatIfIdle();
  }

  private startHeartbeatIfNeeded(): void {
    if (this.heartbeat !== null) return;
    this.heartbeat = setInterval(() => {
      this.broadcast('ping', { timestamp: new Date().toISOString() });
    }, HEARTBEAT_INTERVAL_MS);
    // The heartbeat must never keep the process alive on its own.
    this.heartbeat.unref?.();
  }

  private stopHeartbeatIfIdle(): void {
    if (this.clients.size === 0 && this.heartbeat !== null) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }
}

/** Process-wide singleton: one backend, one broadcast domain (research §7). */
export const eventManager = new EventManager();

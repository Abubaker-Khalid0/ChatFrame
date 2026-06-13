import {
  SseImportCompletedEventSchema,
  SseImportErrorEventSchema,
  SseImportProgressEventSchema,
  SseImportWarningEventSchema,
  type ImportProgress,
  type SseImportErrorEvent,
  type SseImportWarningEvent,
} from '@chatframe/shared';
import type { EventSourceLike } from './events';
import { useImportStore } from '../stores/useImportStore';

/**
 * SSE client for the import events on `GET /api/events` (007 FR-016, FR-023;
 * parallels `events.ts`). Parses `import.progress` / `import.warning` /
 * `import.error` / `import.completed`, dispatches them to the import store,
 * and reconnects with exponential backoff (1s, 2s, 4s). Missed events
 * self-heal through the `GET /api/import/:importId/status` fallback the
 * progress screen performs on mount (contracts/import-api.md).
 */

const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3714';

const BACKOFF_MS = [1_000, 2_000, 4_000] as const;

export interface ImportEventsOptions {
  url?: string;
  /** EventSource factory — injectable because jsdom has no EventSource. */
  createEventSource?: (url: string) => EventSourceLike;
  onProgress: (event: ImportProgress) => void;
  onWarning: (event: SseImportWarningEvent) => void;
  onError: (event: SseImportErrorEvent) => void;
  onCompleted: (event: ImportProgress) => void;
}

export class ImportEventsClient {
  private source: EventSourceLike | null = null;
  private failures = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  constructor(private readonly options: ImportEventsOptions) {}

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
    });
    source.addEventListener('import.progress', (event) => {
      this.dispatch(event, (data) =>
        this.options.onProgress(SseImportProgressEventSchema.parse(data)),
      );
    });
    source.addEventListener('import.warning', (event) => {
      this.dispatch(event, (data) =>
        this.options.onWarning(SseImportWarningEventSchema.parse(data)),
      );
    });
    source.addEventListener('import.error', (event) => {
      this.dispatch(event, (data) => this.options.onError(SseImportErrorEventSchema.parse(data)));
    });
    source.addEventListener('import.completed', (event) => {
      this.dispatch(event, (data) =>
        this.options.onCompleted(SseImportCompletedEventSchema.parse(data)),
      );
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
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private closeSource(): void {
    this.source?.close();
    this.source = null;
  }
}

/** Creates a client wired to {@link useImportStore} (used by the progress page). */
export function createImportEventsClient(): ImportEventsClient {
  const store = useImportStore.getState();
  return new ImportEventsClient({
    onProgress: store.applyProgress,
    onWarning: store.applyWarning,
    onError: store.applyError,
    // Terminal snapshots use the same shape; the stage signals completion.
    onCompleted: store.applyProgress,
  });
}

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RawWhatsAppMessage } from '@chatframe/shared';
import { NdjsonWriter } from '../storage/NdjsonWriter';

/**
 * Streams the adapter's message iterable into the immutable
 * `raw/messages.raw.ndjson` (FR-004, FR-005; research §5).
 *
 * Each record is appended as one NDJSON line via {@link NdjsonWriter} — the
 * full conversation is never held in memory (Constitution XVIII). The cancel
 * token is checked before every record so cancellation stops at a safe
 * boundary with all previously written data preserved (research §7).
 */

export interface MessageFetcherOptions {
  /** Absolute path of the raw NDJSON output. */
  rawPath: string;
  /** Invoked after each written record with the running count (FR-029). */
  onMessage?: (count: number, message: RawWhatsAppMessage) => void;
  /** Cooperative cancellation token, polled between records. */
  isCancelRequested?: () => boolean;
}

export interface MessageFetcherResult {
  /** Messages written to the raw file. */
  count: number;
  /** Whether iteration stopped because cancellation was requested. */
  cancelled: boolean;
}

export class MessageFetcher {
  private readonly options: MessageFetcherOptions;

  constructor(options: MessageFetcherOptions) {
    this.options = options;
  }

  /** Consumes `source`, writing each message as one raw NDJSON line. */
  async run(source: AsyncIterable<RawWhatsAppMessage>): Promise<MessageFetcherResult> {
    // Materialize the raw file up front so an empty conversation still leaves
    // a valid (empty) raw artifact behind (edge case: zero messages).
    await mkdir(dirname(this.options.rawPath), { recursive: true });
    await writeFile(this.options.rawPath, '', { flag: 'a' });

    const writer = new NdjsonWriter(this.options.rawPath);
    let count = 0;
    let cancelled = false;

    try {
      for await (const message of source) {
        if (this.options.isCancelRequested?.()) {
          cancelled = true;
          break;
        }
        await writer.writeRecord(message);
        count += 1;
        this.options.onMessage?.(count, message);
      }
    } finally {
      // Always flush buffered lines so partial data survives cancel/failure.
      await writer.close();
    }

    return { count, cancelled };
  }
}

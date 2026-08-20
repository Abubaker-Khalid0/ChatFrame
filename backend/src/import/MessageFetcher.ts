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
 *
 * Robustness guarantees (Phase 10 hardening):
 * - Adapter stream errors (network drops, library crashes) are caught and
 *   rethrown with a descriptive, user-safe message while preserving already-
 *   written records on disk (raw data remains immutable, Constitution VI).
 * - Each written record is counted only after the write succeeds, so the
 *   reported count is always accurate even if a crash interrupts mid-write.
 * - The NdjsonWriter is always closed in `finally`, ensuring file handles are
 *   released and buffered bytes flushed regardless of outcome.
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

        // Validate basic structural integrity of the adapter output before
        // persisting. A malformed record (missing id or chatId) from the
        // adapter is a programming error — surface it clearly rather than
        // writing corrupted data that will fail at normalization.
        if (!message.id || !message.chatId) {
          throw new Error(
            `Adapter yielded a message without a valid id or chatId (id=${String(message.id)}). ` +
              `${count} messages were written before this failure.`,
          );
        }

        await writer.writeRecord(message);
        count += 1;
        this.options.onMessage?.(count, message);
      }
    } catch (error) {
      // Re-wrap adapter-originated errors with import context while preserving
      // the original error chain for debugging. The raw file already contains
      // all successfully written records up to this point.
      if (
        error instanceof Error &&
        !error.message.startsWith('Adapter yielded') &&
        !error.message.includes('Failed to write NDJSON')
      ) {
        const wrapped = new Error(
          `Message fetching failed after writing ${count} records: ${error.message}`,
        );
        wrapped.cause = error;
        throw wrapped;
      }
      throw error;
    } finally {
      // Always flush buffered lines so partial data survives cancel/failure.
      await writer.close();
    }

    return { count, cancelled };
  }
}

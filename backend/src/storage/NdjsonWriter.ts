import { once } from 'node:events';
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { StorageError } from '../utils/errors';

/**
 * Append-only NDJSON writer (FR-007, FR-008; research §1).
 *
 * Each record is serialized to a single line of JSON terminated by `\n` and
 * appended to the target file via `fs.createWriteStream({ flags: 'a' })`. The
 * writer never reads or rewrites existing content, so raw files remain
 * effectively immutable once written (FR-005, SC-007). Backpressure is honored
 * by awaiting `'drain'` when the internal buffer fills.
 *
 * Robustness (Phase 10 hardening):
 * - JSON serialization failures (circular references, BigInt) are caught per-
 *   record and throw a descriptive StorageError rather than crashing the stream.
 * - Stream errors captured asynchronously are re-raised with full context.
 * - The writer tracks the number of records successfully written, available for
 *   diagnostics via {@link recordsWritten}.
 *
 * Intended for the single-import-at-a-time model (no file locking — spec
 * clarification Q5). Always `close()` the writer to flush buffered bytes.
 */
export class NdjsonWriter {
  private readonly path: string;
  private streamPromise: Promise<WriteStream> | null = null;
  private streamError: Error | null = null;
  private _recordsWritten = 0;

  constructor(path: string) {
    this.path = path;
  }

  /** Number of records successfully appended since construction. */
  get recordsWritten(): number {
    return this._recordsWritten;
  }

  /** Lazily opens the append stream, creating parent directories once. */
  private getStream(): Promise<WriteStream> {
    if (this.streamPromise === null) {
      this.streamPromise = (async () => {
        await mkdir(dirname(this.path), { recursive: true });
        const stream = createWriteStream(this.path, { flags: 'a', encoding: 'utf8' });
        // Capture the first error so writeRecord/close can surface it instead
        // of leaving an unhandled 'error' event.
        stream.on('error', (error: Error) => {
          this.streamError = this.streamError ?? error;
        });
        return stream;
      })();
    }
    return this.streamPromise;
  }

  /**
   * Appends one record as a single JSON line. Honors stream backpressure by
   * awaiting `'drain'` when the buffer is full.
   *
   * @throws {StorageError} when the stream is in an error state or the record
   *   cannot be serialized to JSON.
   */
  async writeRecord(record: unknown): Promise<void> {
    // Check 1: fast-fail if the stream is already broken.
    if (this.streamError !== null) {
      throw new StorageError(
        `Cannot write to '${this.path}': stream is in error state (${this.streamError.message})`,
      );
    }

    // Serialize outside the stream write so serialization failures (circular
    // refs, BigInt, undefined-only objects) get a clear diagnostic.
    let line: string;
    try {
      line = `${JSON.stringify(record)}\n`;
    } catch (serializationError) {
      const detail =
        serializationError instanceof Error ? serializationError.message : 'unknown cause';
      throw new StorageError(
        `Failed to serialize record #${this._recordsWritten + 1} for '${this.path}': ${detail}`,
      );
    }

    const stream = await this.getStream();
    const flushed = stream.write(line);
    if (!flushed) {
      await once(stream, 'drain');
    }
    // Check 2: re-check for errors that occurred during the async write/drain.
    this.throwIfError(
      `Write to '${this.path}' failed after record #${this._recordsWritten + 1}`,
    );
    this._recordsWritten += 1;
  }

  /**
   * Checks whether the stream has entered an error state, throwing a
   * {@link StorageError} with context if so. This helper avoids TypeScript
   * narrowing issues where `this.streamError` is narrowed to `null` after a
   * prior throw guard in the same method.
   */
  private throwIfError(context: string): void {
    if (this.streamError !== null) {
      throw new StorageError(`${context}: ${this.streamError.message}`);
    }
  }

  /** Flushes buffered bytes and closes the underlying stream. Idempotent. */
  async close(): Promise<void> {
    if (this.streamPromise === null) {
      return;
    }
    const stream = await this.streamPromise;
    this.streamPromise = null;
    await new Promise<void>((resolve, reject) => {
      stream.end(() => {
        const error = this.streamError;
        if (error) {
          reject(
            new StorageError(
              `Failed to finalize NDJSON file '${this.path}' after ${this._recordsWritten} records: ${error.message}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }
}

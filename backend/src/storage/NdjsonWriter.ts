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
 * Intended for the single-import-at-a-time model (no file locking — spec
 * clarification Q5). Always `close()` the writer to flush buffered bytes.
 */
export class NdjsonWriter {
  private readonly path: string;
  private streamPromise: Promise<WriteStream> | null = null;
  private streamError: Error | null = null;

  constructor(path: string) {
    this.path = path;
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
   */
  async writeRecord(record: unknown): Promise<void> {
    if (this.streamError) {
      throw new StorageError(`Failed to write NDJSON to '${this.path}'`);
    }
    const stream = await this.getStream();
    const line = `${JSON.stringify(record)}\n`;
    const flushed = stream.write(line);
    if (!flushed) {
      await once(stream, 'drain');
    }
    if (this.streamError) {
      throw new StorageError(`Failed to write NDJSON to '${this.path}'`);
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
        if (this.streamError) {
          reject(new StorageError(`Failed to finalize NDJSON file '${this.path}'`));
        } else {
          resolve();
        }
      });
    });
  }
}

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { StorageError } from '../utils/errors';

/**
 * A non-fatal issue encountered while reading an NDJSON file. Surfaced rather
 * than thrown so a partially-written file (e.g. after an interrupted import)
 * still yields every recoverable record (Constitution XXIII — no silent data
 * loss).
 */
export interface NdjsonWarning {
  code: 'TRUNCATED_FINAL_LINE';
  message: string;
}

/**
 * Streaming NDJSON reader (FR-009, SC-004; research §1).
 *
 * Reads one line at a time with `readline` over `fs.createReadStream` and
 * yields parsed records via an async iterator, so the whole file is never held
 * in memory (SC-002). Blank lines are tolerated. An unparseable final line is
 * treated as a truncated trailing record: it is skipped and reported via
 * {@link warnings} instead of throwing. An unparseable line followed by more
 * content is genuine mid-file corruption and raises a {@link StorageError}.
 */
export class NdjsonReader<T = unknown> {
  private readonly path: string;
  /** Non-fatal issues discovered during the most recent {@link read} pass. */
  readonly warnings: NdjsonWarning[] = [];

  constructor(path: string) {
    this.path = path;
  }

  /** Streams records one at a time as an async iterable. */
  async *read(): AsyncGenerator<T> {
    this.warnings.length = 0;
    const stream = createReadStream(this.path, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    // Holds a non-blank line that failed to parse. If anything non-blank
    // follows it, that line was mid-file corruption; if EOF follows, it was a
    // truncated trailing line.
    let pending: string | null = null;

    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          continue;
        }

        let parsed: T;
        try {
          parsed = JSON.parse(trimmed) as T;
        } catch {
          if (pending !== null) {
            throw new StorageError(
              `Malformed NDJSON in '${this.path}': unparseable line before end of file`,
            );
          }
          pending = trimmed;
          continue;
        }

        if (pending !== null) {
          throw new StorageError(
            `Malformed NDJSON in '${this.path}': unparseable line before end of file`,
          );
        }
        yield parsed;
      }

      if (pending !== null) {
        this.warnings.push({
          code: 'TRUNCATED_FINAL_LINE',
          message:
            'Recovered from a truncated final line; the last record was incomplete and skipped.',
        });
      }
    } finally {
      rl.close();
      stream.destroy();
    }
  }
}

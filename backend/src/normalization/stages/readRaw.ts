import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import {
  RawWhatsAppMessageSchema,
  type QualityWarning,
  type RawWhatsAppMessage,
} from '@chatframe/shared';

/**
 * Raw-message reader (FR-001).
 *
 * Streams `raw/messages.raw.ndjson` one line at a time and validates each line
 * against {@link RawWhatsAppMessageSchema}. Per FR-001 and the "interleaved
 * valid and invalid lines" edge case, an invalid line (malformed JSON *or* a
 * schema failure) is surfaced as an `INVALID_RAW_MESSAGE` warning carrying the
 * 1-based line number and processing continues — nothing is silently dropped
 * (Constitution XXIII).
 *
 * NOTE: This stage intentionally does not reuse {@link ../storage/NdjsonReader}.
 * That reader treats a mid-file unparseable line as a fatal `StorageError`
 * (recovering only a truncated *final* line), which would abort the run on the
 * first interleaved bad line — contrary to FR-001's warn-and-continue rule.
 * Here we own the per-line loop so every recoverable line still yields.
 *
 * Output is a stream of events so the caller (the pipeline) can map valid
 * records and accumulate warnings without buffering the whole file (SC-002,
 * Constitution XVIII).
 */

export type RawReadEvent =
  | { kind: 'message'; lineNumber: number; message: RawWhatsAppMessage }
  | { kind: 'invalid'; lineNumber: number; warning: QualityWarning };

/** Streams raw-read events from an NDJSON file. Blank lines are ignored. */
export async function* readRawMessages(path: string): AsyncGenerator<RawReadEvent> {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  try {
    for await (const line of rl) {
      lineNumber += 1;
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        yield {
          kind: 'invalid',
          lineNumber,
          warning: {
            code: 'INVALID_RAW_MESSAGE',
            message: `Line ${lineNumber}: not valid JSON; skipped and recorded.`,
          },
        };
        continue;
      }

      const result = RawWhatsAppMessageSchema.safeParse(parsed);
      if (!result.success) {
        yield {
          kind: 'invalid',
          lineNumber,
          warning: {
            code: 'INVALID_RAW_MESSAGE',
            message: `Line ${lineNumber}: raw message failed schema validation; recorded.`,
          },
        };
        continue;
      }

      yield { kind: 'message', lineNumber, message: result.data };
    }
  } finally {
    rl.close();
    stream.destroy();
  }
}

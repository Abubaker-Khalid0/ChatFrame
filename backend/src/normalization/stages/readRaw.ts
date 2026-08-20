import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
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
 * Robustness features (Phase 10 hardening):
 * - BOM detection and stripping (files exported from some tools carry a UTF-8
 *   BOM on the first line, which breaks JSON.parse).
 * - Line length guard: abnormally long lines (>2 MB) are rejected outright to
 *   prevent accidental memory spikes from a corrupted or binary file.
 * - Stream-level error handling: filesystem I/O errors (permission, disk) are
 *   surfaced cleanly without leaking raw error detail.
 * - Schema failure diagnostics include the first failing path for debugging.
 *
 * Output is a stream of events so the caller (the pipeline) can map valid
 * records and accumulate warnings without buffering the whole file (SC-002,
 * Constitution XVIII).
 */

/** Maximum allowed line length (bytes) before a line is considered corrupt. */
const MAX_LINE_LENGTH = 2 * 1024 * 1024; // 2 MB

/** UTF-8 BOM character (U+FEFF, encoded as 3 bytes EF BB BF). */
const UTF8_BOM = '\uFEFF';

export type RawReadEvent =
  | { kind: 'message'; lineNumber: number; message: RawWhatsAppMessage }
  | { kind: 'invalid'; lineNumber: number; warning: QualityWarning };

/**
 * Strips a leading UTF-8 BOM from the first line of a file. Some export tools
 * (Windows Notepad, Excel) prepend this invisible character which causes
 * JSON.parse to fail on the first record.
 */
function stripBom(line: string, lineNumber: number): string {
  if (lineNumber === 1 && line.startsWith(UTF8_BOM)) {
    return line.slice(1);
  }
  return line;
}

/**
 * Formats the first Zod issue path into a human-readable hint so operators can
 * identify which field caused the schema failure without exposing full Zod
 * internals. Returns an empty string when no path is available.
 */
function firstIssuePath(issues: { path: (string | number)[] }[]): string {
  const first = issues[0];
  if (!first || first.path.length === 0) return '';
  return ` (field: ${first.path.join('.')})`;
}

/** Streams raw-read events from an NDJSON file. Blank lines are ignored. */
export async function* readRawMessages(path: string): AsyncGenerator<RawReadEvent> {
  // Pre-check: verify the file exists and is readable before opening the
  // stream. This gives a clear error message (vs. a cryptic ENOENT mid-stream)
  // and surfaces zero-byte files as a distinct edge case.
  const fileStat = await stat(path).catch((error: NodeJS.ErrnoException) => {
    const code = error.code ?? 'UNKNOWN';
    throw new Error(
      `Cannot read raw messages file at '${path}': ${code === 'ENOENT' ? 'file does not exist' : `filesystem error (${code})`}`,
    );
  });
  if (!fileStat.isFile()) {
    throw new Error(`Raw messages path '${path}' is not a regular file.`);
  }

  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  let streamError: Error | null = null;

  // Capture stream-level I/O errors (disk failure, permission revoked mid-read)
  // so we can surface them after the line loop exits rather than crashing with
  // an unhandled 'error' event.
  stream.on('error', (error: Error) => {
    streamError = streamError ?? error;
  });

  try {
    for await (const rawLine of rl) {
      lineNumber += 1;

      // Strip BOM from the first line if present.
      const line = stripBom(rawLine, lineNumber);
      const trimmed = line.trim();

      if (trimmed.length === 0) {
        continue;
      }

      // Guard against abnormally long lines that could indicate a binary or
      // corrupted file being fed in, preventing runaway memory allocation.
      if (trimmed.length > MAX_LINE_LENGTH) {
        yield {
          kind: 'invalid',
          lineNumber,
          warning: {
            code: 'INVALID_RAW_MESSAGE',
            message: `Line ${lineNumber}: line exceeds maximum length (${MAX_LINE_LENGTH} bytes); skipped.`,
          },
        };
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

      // Reject non-object JSON values (arrays, strings, numbers, booleans, null)
      // early with a clearer message than the generic schema failure.
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        yield {
          kind: 'invalid',
          lineNumber,
          warning: {
            code: 'INVALID_RAW_MESSAGE',
            message: `Line ${lineNumber}: JSON value is not an object; skipped.`,
          },
        };
        continue;
      }

      const result = RawWhatsAppMessageSchema.safeParse(parsed);
      if (!result.success) {
        const hint = firstIssuePath(result.error.issues);
        yield {
          kind: 'invalid',
          lineNumber,
          warning: {
            code: 'INVALID_RAW_MESSAGE',
            message: `Line ${lineNumber}: raw message failed schema validation${hint}; recorded.`,
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

  // Surface any I/O error that occurred during the stream read. At this point
  // all recoverable lines have already been yielded, so the caller gets partial
  // results before this throws (matching the "never silently drop" principle).
  if (streamError) {
    throw new Error(
      `I/O error while reading raw messages at '${path}': ${(streamError as Error).message}`,
    );
  }
}

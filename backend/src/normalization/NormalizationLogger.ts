import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pino, { type Logger } from 'pino';

/**
 * Structured per-step logging for the normalization pipeline (FR-022).
 *
 * Writes one JSON line per stage to `logs/normalization.log`. Only structural
 * metadata is recorded — step name, record counts, duration, and a warning
 * *count*. Message bodies, captions, sender names, tokens, and QR data are
 * NEVER logged (FR-023, Constitution XIII). The `logStep` signature
 * intentionally accepts only numeric/string metadata so content cannot leak.
 */

/** A single structural log entry for one pipeline stage. */
export interface StepLog {
  /** Stage name (e.g. `readRaw`, `sortMessages`). */
  step: string;
  /** Records received by the stage. */
  inputCount: number;
  /** Records produced by the stage. */
  outputCount: number;
  /** Wall-clock duration of the stage, in milliseconds. */
  durationMs: number;
  /** Number of warnings accumulated so far (count only — no messages). */
  warnings: number;
}

export class NormalizationLogger {
  private readonly logger: Logger;

  constructor(logPath: string) {
    // Ensure the logs/ directory exists before opening the destination.
    mkdirSync(dirname(logPath), { recursive: true });
    // `base: null` drops pid/hostname; synchronous destination keeps the
    // file consistent for tests and short-lived runs.
    this.logger = pino(
      { base: null },
      pino.destination({ dest: logPath, sync: true, mkdir: true }),
    );
  }

  /** Appends one structural step entry. */
  logStep(entry: StepLog): void {
    this.logger.info(entry, 'normalization_step');
  }
}

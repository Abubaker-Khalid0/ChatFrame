import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pino, { type Logger } from 'pino';
import type { ImportStage } from '@chatframe/shared';

/**
 * Sanitized per-import logging to `logs/import.log` (FR-026, SC-010).
 *
 * Writes one JSON line per entry. Only structural metadata is recorded —
 * stage names, message/image counts, durations, and message/media **ids**.
 * Message bodies, captions, sender names, QR payloads, tokens, and session
 * data are NEVER logged (Constitution XIII, XIX). The method signatures
 * intentionally accept only ids, counts, and codes so content cannot leak —
 * the guarantee is structural, not filter-based (research §10).
 */

/** A stage transition with the counters at that moment. */
export interface StageLogEntry {
  stage: ImportStage;
  messagesImported: number;
  imagesDownloaded: number;
  /** Number of warnings accumulated so far (count only — no text). */
  warnings: number;
  /** Milliseconds since the import started. */
  elapsedMs: number;
}

/** A structured non-stage event (warning/error/outcome), ids and codes only. */
export interface EventLogEntry {
  event: string;
  code?: string;
  messageId?: string;
  mediaId?: string;
}

export class ImportLogger {
  private readonly logger: Logger;

  constructor(logPath: string) {
    // Ensure the logs/ directory exists before opening the destination.
    mkdirSync(dirname(logPath), { recursive: true });
    // `base: null` drops pid/hostname; the synchronous destination keeps the
    // file consistent for tests and short-lived runs.
    this.logger = pino(
      { base: null },
      pino.destination({ dest: logPath, sync: true, mkdir: true }),
    );
  }

  /** Appends one stage-transition entry. */
  logStage(entry: StageLogEntry): void {
    this.logger.info(entry, 'import_stage');
  }

  /** Appends one structured event entry (ids and codes only). */
  logEvent(entry: EventLogEntry): void {
    this.logger.info(entry, 'import_event');
  }
}

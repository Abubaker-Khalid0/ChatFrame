import type { ImportProgress, ImportStage } from '@chatframe/shared';

/**
 * In-memory, single-slot import registry (FR-017; data-model §8, research §1).
 *
 * Enforces exactly one active import process-wide: {@link start} rejects a
 * concurrent start with {@link ImportInProgressError} (mapped to 409 by the
 * route). It owns the live {@link ImportProgress} snapshot returned by the
 * status endpoint and the cooperative cancellation token polled by the
 * orchestrator at safe boundaries (research §7). State is process-local — the
 * durable outcome lives in `project.json` (Constitution V).
 */

/** Raised when an import is requested while another one is active. */
export class ImportInProgressError extends Error {
  readonly code = 'IMPORT_IN_PROGRESS';
  constructor() {
    super('An import is already in progress.');
    this.name = 'ImportInProgressError';
  }
}

/**
 * Stages during which a cancel request is honored (data-model §1).
 * `preparing_project` and the terminal stages ignore cancellation (US4 AC-5).
 */
export const CANCELLABLE_STAGES: ReadonlySet<ImportStage> = new Set<ImportStage>([
  'fetching_metadata',
  'fetching_messages',
  'saving_raw_messages',
  'downloading_images',
  'normalizing',
  'resolving_replies',
  'generating_quality_report',
  'preparing_preview',
]);

let activeImportId: string | null = null;
let progress: ImportProgress | null = null;
let cancelRequested = false;

/**
 * Claims the single import slot for `importId`. Throws
 * {@link ImportInProgressError} when another import is active (FR-017).
 */
export function start(importId: string): void {
  if (activeImportId !== null) {
    throw new ImportInProgressError();
  }
  activeImportId = importId;
  progress = null;
  cancelRequested = false;
}

/** Replaces the live progress snapshot. */
export function update(next: ImportProgress): void {
  progress = next;
}

/**
 * Returns the live (or most recent terminal) progress for `importId`, or
 * `null` when the id is unknown. Terminal snapshots survive {@link clear} so a
 * late status read after completion still resolves (contracts/import-api.md).
 */
export function getProgress(importId: string): ImportProgress | null {
  return progress !== null && progress.importId === importId ? progress : null;
}

/**
 * Registers a cancellation request for the active import. Returns `true` when
 * the request was registered, or `false` when it was ignored because the id is
 * not the active import or the current stage is non-cancellable (US4 AC-5).
 */
export function requestCancel(importId: string): boolean {
  if (activeImportId !== importId || progress === null) {
    return false;
  }
  if (!CANCELLABLE_STAGES.has(progress.stage)) {
    return false;
  }
  cancelRequested = true;
  return true;
}

/** Whether a cancellation has been requested for the active import. */
export function isCancelRequested(): boolean {
  return cancelRequested;
}

/**
 * Releases the import slot (called on a terminal stage). The last progress
 * snapshot is intentionally retained for late status reads; the next
 * {@link start} resets it.
 */
export function clear(): void {
  activeImportId = null;
  cancelRequested = false;
}

/** Wipes all registry state, including the retained snapshot. Test-only. */
export function resetImportRegistry(): void {
  activeImportId = null;
  progress = null;
  cancelRequested = false;
}

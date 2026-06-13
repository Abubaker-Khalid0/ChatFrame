/**
 * In-memory, per-project export lock (009 research §8, FR-021).
 *
 * Enforces one export at a time per project: {@link acquireExportLock} throws
 * {@link ExportInProgressError} (mapped to 409 by the route) when a lock is
 * already held. Process-local state suffices for the single local backend
 * (Constitution XVII), mirroring `normalization/runRegistry.ts`.
 */

/** Raised when an export is requested while one is already running. */
export class ExportInProgressError extends Error {
  readonly code = 'EXPORT_IN_PROGRESS';
  constructor() {
    super('An export is already in progress for this project');
    this.name = 'ExportInProgressError';
  }
}

const activeExports = new Set<string>();

/** Whether an export is currently running for the project. */
export function isExporting(projectId: string): boolean {
  return activeExports.has(projectId);
}

/**
 * Acquires the export lock for `projectId`. Throws
 * {@link ExportInProgressError} when the lock is already held. The caller MUST
 * release in a `finally` on both success and failure.
 */
export function acquireExportLock(projectId: string): void {
  if (activeExports.has(projectId)) {
    throw new ExportInProgressError();
  }
  activeExports.add(projectId);
}

/** Releases the export lock for `projectId` (idempotent). */
export function releaseExportLock(projectId: string): void {
  activeExports.delete(projectId);
}

/** Clears all locks. Intended for test isolation. */
export function resetExportRegistry(): void {
  activeExports.clear();
}

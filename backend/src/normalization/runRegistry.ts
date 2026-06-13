import type { NormalizationState, NormalizationStatus } from '@chatframe/shared';

/**
 * In-memory, per-project normalization run registry (FR-020, Assumptions).
 *
 * Enforces a single active run per project: {@link startRun} rejects a second
 * concurrent start with {@link NormalizationInProgressError} (mapped to 409 by
 * the route). State is process-local, which suffices for the single-user local
 * app (no database, Constitution V). Tracking is keyed by project id.
 */

/** Reports a `currentStep` update to the registry while a run is in progress. */
export type StepReporter = (step: string) => void;

/** Raised when a run is requested while one is already active for the project. */
export class NormalizationInProgressError extends Error {
  readonly code = 'NORMALIZATION_IN_PROGRESS';
  constructor() {
    super('Normalization is already running for this project');
    this.name = 'NormalizationInProgressError';
  }
}

interface RunRecord {
  status: NormalizationStatus;
  /** The in-flight run promise (settles when the run completes or fails). */
  promise: Promise<void>;
}

const runs = new Map<string, RunRecord>();

function idleStatus(projectId: string): NormalizationStatus {
  return {
    projectId,
    state: 'idle',
    startedAt: null,
    completedAt: null,
    currentStep: null,
    error: null,
  };
}

/** Returns the current status for a project (idle if no run has been recorded). */
export function getStatus(projectId: string): NormalizationStatus {
  return runs.get(projectId)?.status ?? idleStatus(projectId);
}

/** Whether a run is currently active for the project. */
export function isRunning(projectId: string): boolean {
  return runs.get(projectId)?.status.state === 'running';
}

/**
 * Starts a run for `projectId`, invoking `runner` with a step reporter. Returns
 * the initial `running` status synchronously; the run itself proceeds in the
 * background and the registry status transitions to `completed`/`failed` when
 * it settles. Throws {@link NormalizationInProgressError} if a run is active.
 */
export function startRun(
  projectId: string,
  runner: (report: StepReporter) => Promise<void>,
  now: () => Date = () => new Date(),
): NormalizationStatus {
  if (isRunning(projectId)) {
    throw new NormalizationInProgressError();
  }

  const status: NormalizationStatus = {
    projectId,
    state: 'running',
    startedAt: now().toISOString(),
    completedAt: null,
    currentStep: null,
    error: null,
  };

  const report: StepReporter = (step) => {
    status.currentStep = step;
  };

  const settle = (state: NormalizationState, error: string | null): void => {
    status.state = state;
    status.completedAt = now().toISOString();
    status.currentStep = null;
    status.error = error;
  };

  const promise = (() => {
    try {
      // Invoke the runner synchronously so an immediate `report(step)` is
      // observable before this function returns; capture a synchronous throw
      // as a rejection rather than letting it escape.
      return Promise.resolve(runner(report));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error('Normalization failed'));
    }
  })()
    .then(() => settle('completed', null))
    .catch((err: unknown) => {
      // Keep the message user-safe: never surface raw error internals/content.
      const message = err instanceof Error && err.message ? err.message : 'Normalization failed';
      settle('failed', message);
    });

  runs.set(projectId, { status, promise });
  return { ...status };
}

/** Awaits the active (or most recent) run for a project, if any. */
export async function whenSettled(projectId: string): Promise<void> {
  await runs.get(projectId)?.promise;
}

/** Clears all tracked runs. Intended for test isolation. */
export function resetRegistry(): void {
  runs.clear();
}

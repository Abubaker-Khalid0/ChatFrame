/**
 * In-memory session-action mutex (FR-023, research §7): the adapter is a
 * single instance backed by one Chromium process, so only one session-mutating
 * action (connect, restore, or logout) may run at a time. Concurrent attempts
 * are rejected by the routes with `409 Conflict`. The backend is
 * single-process, so a module-level flag is sufficient — no distributed lock.
 */

let lockedBy: string | null = null;

/**
 * Attempts to acquire the session lock for `action`. Returns a release
 * function on success, or `null` when another action is already in progress.
 * The release function is idempotent.
 */
export function tryAcquireSessionLock(action: string): (() => void) | null {
  if (lockedBy !== null) {
    return null;
  }
  lockedBy = action;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      lockedBy = null;
    }
  };
}

/** True while a session-mutating action holds the lock. */
export function isSessionActionInProgress(): boolean {
  return lockedBy !== null;
}

/** Force-releases the lock. Intended for tests. */
export function resetSessionLock(): void {
  lockedBy = null;
}

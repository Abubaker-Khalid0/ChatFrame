import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizedDir, stagingDirPath } from '../projects/ProjectPaths';

/**
 * Atomic staging for normalized outputs (FR-021).
 *
 * The pipeline writes every output into a per-run staging directory
 * (`normalized.tmp-<runId>/`) inside the project folder. On full success the
 * staged files are atomically promoted into `normalized/` via `rename` (same
 * volume, so the move is atomic on Windows/macOS/Linux). On any failure the
 * staging directory is removed and `normalized/` is left untouched — so a
 * crashed or interrupted run never leaves partial artifacts (edge cases).
 */

/** Creates (and returns) the staging directory for a run. */
export async function createStagingDir(projectDir: string, runId: string): Promise<string> {
  const dir = stagingDirPath(projectDir, runId);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Promotes every file in `stagingDir` into the project's `normalized/`
 * directory, overwriting existing outputs, then removes the staging directory.
 * Only the staged files are moved, so pre-existing files not produced by this
 * run (e.g. `media.json`, owned by `MediaStore`) are preserved.
 */
export async function promoteStaging(projectDir: string, stagingDir: string): Promise<void> {
  const targetDir = normalizedDir(projectDir);
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(stagingDir);
  for (const name of entries) {
    // Remove any existing target first so `rename` succeeds across platforms
    // (Windows `rename` rejects an existing destination).
    const target = join(targetDir, name);
    await rm(target, { force: true });
    await rename(join(stagingDir, name), target);
  }

  await rm(stagingDir, { recursive: true, force: true });
}

/** Removes the staging directory, ignoring a missing directory. */
export async function cleanupStaging(stagingDir: string): Promise<void> {
  await rm(stagingDir, { recursive: true, force: true });
}

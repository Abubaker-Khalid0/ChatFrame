import { readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { PROJECTS_DIR, SESSION_DIR } from '../config/paths';

/**
 * Session protection (FR-019, Constitution XIII): session files must never be
 * included in exports, project folders, or log output. This module guards the
 * filesystem boundary — the session directory must never overlap any
 * project/export path, and after logout zero session files may remain.
 */

/** True when `child` equals `parent` or lives anywhere underneath it. */
function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  // An empty rel means the paths are equal; a rel starting with '..' or an
  // absolute rel (different drive on Windows) means child is outside parent.
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** True when either path contains the other (any overlap at all). */
export function pathsOverlap(a: string, b: string): boolean {
  return isInside(a, b) || isInside(b, a);
}

/**
 * Asserts the session directory never overlaps the projects directory (and by
 * extension any project or export path, which all live under it). Called at
 * startup so a misconfigured `SESSION_DIR` fails loudly (Constitution XIX).
 */
export function assertSessionDirIsolated(
  sessionDirPath: string = SESSION_DIR,
  projectsDirPath: string = PROJECTS_DIR,
): void {
  if (pathsOverlap(sessionDirPath, projectsDirPath)) {
    throw new Error(
      `SESSION_DIR (${sessionDirPath}) must not overlap the projects directory ` +
        `(${projectsDirPath}); session files are never part of a project or export.`,
    );
  }
}

/**
 * Guard for export and logging code paths: returns true when `candidate`
 * points into the session directory and must therefore be excluded.
 */
export function isSessionPath(candidate: string, sessionDirPath: string = SESSION_DIR): boolean {
  return isInside(sessionDirPath, candidate);
}

/** Recursively lists all files (not directories) under `dir`; [] if absent. */
export async function listFilesRecursively(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

/**
 * Post-logout check (FR-018, SC-004): asserts that zero session-related files
 * remain in the session directory. A missing directory counts as empty.
 */
export async function assertSessionDirEmpty(sessionDirPath: string = SESSION_DIR): Promise<void> {
  const remaining = await listFilesRecursively(sessionDirPath);
  if (remaining.length > 0) {
    throw new Error(
      `Session cleanup incomplete: ${remaining.length} file(s) remain in the session directory.`,
    );
  }
}

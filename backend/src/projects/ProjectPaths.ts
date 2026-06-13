import { join } from 'node:path';
import type { PathWarning } from '@chatframe/shared';
import {
  DEEPEST_EXPORT_SUFFIX,
  EXPORT_ASSETS_DIR,
  EXPORT_HTML_DIR,
  EXPORT_HTML_FILE,
  EXPORT_STAGING_PREFIX,
  EXPORTS_DIR,
  IMPORT_LOG_FILE,
  NORMALIZATION_LOG_FILE,
  NORMALIZED_DIR,
  NORMALIZED_MESSAGES_FILE,
  PARTICIPANTS_FILE,
  PATH_LENGTH_WARNING_THRESHOLD,
  PROJECTS_DIR,
  QUALITY_REPORT_FILE,
  RAW_MEDIA_FILE,
  RAW_MESSAGES_FILE,
  RENDER_MODEL_FILE,
  STAGING_DIR_PREFIX,
} from '../config/paths';

/**
 * Deterministic, Unicode-aware path generation for project folders
 * (FR-014, FR-019, FR-020, FR-021; research §2, §3).
 */

/** Maximum length of a project folder name, in code points (FR-020). */
export const MAX_FOLDER_NAME_LENGTH = 80;

/** The fixed `chatframe_` prefix that every folder name carries. */
const FOLDER_PREFIX = 'chatframe_';

/**
 * Characters forbidden in Windows filenames (`/ \ : * ? " < > |`) plus ASCII
 * control characters (0x00–0x1F). This set is the most restrictive across
 * Windows/macOS/Linux, so stripping it keeps names valid everywhere (research §2).
 */
// Control characters (0x00–0x1F) are matched intentionally to strip them.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[\u0000-\u001f/\\:*?"<>|]/g;

/**
 * Slugifies a contact name for use in a folder name. Unicode (including Arabic)
 * is preserved; only forbidden/control characters are stripped. Internal
 * whitespace is collapsed to single spaces and trailing dots/spaces (which
 * Windows disallows) are removed. Falls back to `chat` when nothing remains.
 */
export function slugify(name: string): string {
  const cleaned = name.replace(FORBIDDEN_CHARS, '').replace(/\s+/g, ' ').trim();
  const trimmed = cleaned.replace(/[. ]+$/, '');
  return trimmed.length > 0 ? trimmed : 'chat';
}

/**
 * Builds the deterministic folder name `chatframe_<date>_<slug>`, truncating
 * the slug so the whole name stays within {@link MAX_FOLDER_NAME_LENGTH} code
 * points (FR-020). `date` is expected as `YYYY-MM-DD`.
 */
export function buildFolderName(date: string, name: string): string {
  const slug = slugify(name);
  const prefix = `${FOLDER_PREFIX}${date}_`;
  const available = Math.max(MAX_FOLDER_NAME_LENGTH - prefix.length, 0);
  // Slice by code points so multi-byte characters are never split.
  const truncatedSlug = [...slug]
    .slice(0, available)
    .join('')
    .replace(/[. ]+$/, '');
  return `${prefix}${truncatedSlug}`;
}

/**
 * Returns a folder name that does not collide with any of `existingNames`,
 * appending `-2`, `-3`, … when the desired name is already taken (FR-014).
 */
export function dedupeFolderName(desired: string, existingNames: readonly string[]): string {
  const existing = new Set(existingNames);
  if (!existing.has(desired)) {
    return desired;
  }
  let suffix = 2;
  while (existing.has(`${desired}-${suffix}`)) {
    suffix += 1;
  }
  return `${desired}-${suffix}`;
}

/**
 * Returns a non-blocking {@link PathWarning} when the deepest file a project
 * can produce would exceed the path-length threshold, or `null` otherwise
 * (FR-021, research §3). `projectPath` is the absolute project folder path.
 */
export function checkPathLength(projectPath: string): PathWarning | null {
  const deepestPath = join(projectPath, DEEPEST_EXPORT_SUFFIX);
  if (deepestPath.length > PATH_LENGTH_WARNING_THRESHOLD) {
    return {
      code: 'PATH_LENGTH_WARNING',
      message:
        `Project path is ${deepestPath.length} characters. ` +
        'Windows may have issues with paths exceeding 260 characters.',
    };
  }
  return null;
}

/**
 * Absolute-path helpers for the files the normalization pipeline reads and
 * writes (FR-021, FR-022). Each takes the absolute project folder path so the
 * pipeline and tests can operate on any project directory (including temp dirs).
 */

/** Absolute path to a project folder under {@link PROJECTS_DIR}. */
export function projectDirPath(projectId: string, projectsDir: string = PROJECTS_DIR): string {
  return join(projectsDir, projectId);
}

/** Immutable raw NDJSON input. */
export function rawMessagesPath(projectDir: string): string {
  return join(projectDir, RAW_MESSAGES_FILE);
}

/** Immutable raw media provenance NDJSON written during import (007 FR-007). */
export function rawMediaPath(projectDir: string): string {
  return join(projectDir, RAW_MEDIA_FILE);
}

/** Sanitized import log file (007 FR-026). */
export function importLogPath(projectDir: string): string {
  return join(projectDir, IMPORT_LOG_FILE);
}

/** `normalized/` directory. */
export function normalizedDir(projectDir: string): string {
  return join(projectDir, NORMALIZED_DIR);
}

/** Normalized messages NDJSON output. */
export function normalizedMessagesPath(projectDir: string): string {
  return join(projectDir, NORMALIZED_MESSAGES_FILE);
}

/** Quality report JSON output. */
export function qualityReportPath(projectDir: string): string {
  return join(projectDir, QUALITY_REPORT_FILE);
}

/** Participants JSON output. */
export function participantsPath(projectDir: string): string {
  return join(projectDir, PARTICIPANTS_FILE);
}

/** Render model JSON output. */
export function renderModelPath(projectDir: string): string {
  return join(projectDir, RENDER_MODEL_FILE);
}

/** Normalization log file. */
export function normalizationLogPath(projectDir: string): string {
  return join(projectDir, NORMALIZATION_LOG_FILE);
}

/** Per-run staging directory `normalized.tmp-<runId>/` inside the project. */
export function stagingDirPath(projectDir: string, runId: string): string {
  return join(projectDir, `${STAGING_DIR_PREFIX}${runId}`);
}

/**
 * HTML-export path helpers (009 data-model §4). The export is built in a
 * per-run staging directory under `exports/` and atomically promoted to
 * `exports/html/` on success (research §7).
 */

/** Promoted HTML export directory `exports/html/`. */
export function exportHtmlDir(projectDir: string): string {
  return join(projectDir, EXPORT_HTML_DIR);
}

/** Assets directory `exports/html/assets/` of the promoted export. */
export function exportAssetsDir(projectDir: string): string {
  return join(projectDir, EXPORT_HTML_DIR, EXPORT_ASSETS_DIR);
}

/** The static entry file `exports/html/conversation.html`. */
export function exportHtmlFilePath(projectDir: string): string {
  return join(projectDir, EXPORT_HTML_DIR, EXPORT_HTML_FILE);
}

/** Per-run export staging directory `exports/html.tmp-<runId>/`. */
export function exportStagingDir(projectDir: string, runId: string): string {
  return join(projectDir, EXPORTS_DIR, `${EXPORT_STAGING_PREFIX}${runId}`);
}

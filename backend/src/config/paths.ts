import { isAbsolute, join, resolve } from 'node:path';
import { env } from './env';

/**
 * Workspace and project path constants (FR-001, FR-021; research §3, §6).
 *
 * The workspace root holds all local project data and is resolved from
 * `WORKSPACE_DIR` (default `./chatframe-data`). Projects live under the
 * `projects/` subdirectory. These constants are the single source of truth for
 * filesystem layout used by the storage modules.
 */

/** Absolute path to the workspace root (resolved from `WORKSPACE_DIR`). */
export const WORKSPACE_ROOT: string = isAbsolute(env.WORKSPACE_DIR)
  ? env.WORKSPACE_DIR
  : resolve(process.cwd(), env.WORKSPACE_DIR);

/** Absolute path to the directory that holds all project folders. */
export const PROJECTS_DIR: string = join(WORKSPACE_ROOT, 'projects');

/**
 * Absolute path to the WhatsApp session root (resolved from `SESSION_DIR`).
 * Deliberately outside {@link PROJECTS_DIR}: session files are protected local
 * data and never belong to a project or an export (FR-012, Constitution XIII).
 */
export const SESSION_DIR: string = isAbsolute(env.SESSION_DIR)
  ? env.SESSION_DIR
  : resolve(process.cwd(), env.SESSION_DIR);

/** Returns the session root directory. */
export function sessionDir(): string {
  return SESSION_DIR;
}

/**
 * Returns the directory handed to `whatsapp-web.js` `LocalAuth` as `dataPath`.
 * All library-managed session files live under this path (research §3).
 */
export function whatsappWebJsSessionPath(): string {
  return join(SESSION_DIR, 'whatsapp-web-js');
}

/**
 * Returns the directory used by Baileys `useMultiFileAuthState` for
 * session/auth credentials. Replaces the Chromium-based session storage.
 */
export function baileysSessionPath(): string {
  return join(SESSION_DIR, 'baileys-auth');
}

/**
 * The deepest-nested path a project ever produces, relative to the project
 * folder root. Used to estimate the worst-case absolute path length at project
 * creation time (research §3).
 */
export const DEEPEST_EXPORT_SUFFIX = join('exports', 'html', 'assets', 'media', 'img_000001.jpg');

/**
 * Path-length warning threshold in characters. The Windows MAX_PATH limit is
 * 260; we warn at 240 to leave a 20-char safety margin (FR-021, research §3).
 * Exceeding it produces a non-blocking warning, not an error.
 */
export const PATH_LENGTH_WARNING_THRESHOLD = 240;

/**
 * Canonical file/directory names within a project folder used by the
 * normalization pipeline (FR-021, FR-022). Paths are relative to the project
 * folder root; {@link ProjectPaths} composes them into absolute paths.
 */

/** Immutable raw input read by the pipeline (Constitution VI). */
export const RAW_MESSAGES_FILE = join('raw', 'messages.raw.ndjson');

/** Immutable raw media provenance log written during import (007 FR-007). */
export const RAW_MEDIA_FILE = join('raw', 'media.raw.ndjson');

/** Sanitized per-import log — ids/counts/timing only (007 FR-026, SC-010). */
export const IMPORT_LOG_FILE = join('logs', 'import.log');

/** Directory holding all derived normalized outputs. */
export const NORMALIZED_DIR = 'normalized';

/** Normalized messages output (one `NormalizedMessage` per line). */
export const NORMALIZED_MESSAGES_FILE = join(NORMALIZED_DIR, 'messages.ndjson');

/** Quality report output (FR-010). */
export const QUALITY_REPORT_FILE = join(NORMALIZED_DIR, 'quality-report.json');

/** Resolved participants output (FR-011). */
export const PARTICIPANTS_FILE = join(NORMALIZED_DIR, 'participants.json');

/** Render model output consumed by the preview (FR-013). */
export const RENDER_MODEL_FILE = join(NORMALIZED_DIR, 'render-model.json');

/** Directory holding stored image bytes, served by the media route (008 FR-003). */
export const MEDIA_IMAGES_DIR = join('media', 'images');

/** Per-step structural normalization log (FR-022). */
export const NORMALIZATION_LOG_FILE = join('logs', 'normalization.log');

/**
 * Prefix for the per-run staging directory. Normalized outputs are written to
 * `normalized.tmp-<runId>/` and atomically promoted to `normalized/` only on
 * full pipeline success (FR-021).
 */
export const STAGING_DIR_PREFIX = 'normalized.tmp-';

/**
 * HTML export layout within a project folder (009 data-model §4). The export
 * is built in a staging directory (`exports/html.tmp-<runId>/`) and atomically
 * promoted to `exports/html/` on full success (research §7).
 */

/** Root directory for all export artifacts. */
export const EXPORTS_DIR = 'exports';

/** Promoted HTML export directory. */
export const EXPORT_HTML_DIR = join(EXPORTS_DIR, 'html');

/** Assets directory inside the HTML export, relative to the export root. */
export const EXPORT_ASSETS_DIR = 'assets';

/** Bundled font files directory, relative to the export root. */
export const EXPORT_FONTS_DIR = join(EXPORT_ASSETS_DIR, 'fonts');

/** Copied images directory, relative to the export root. */
export const EXPORT_MEDIA_DIR = join(EXPORT_ASSETS_DIR, 'media');

/** The static conversation entry file, relative to the export root. */
export const EXPORT_HTML_FILE = 'conversation.html';

/** Byte-identical copy of `chat-renderer.css`, relative to the export root (SC-008). */
export const EXPORT_STYLE_FILE = join(EXPORT_ASSETS_DIR, 'style.css');

/** Generated `@font-face` stylesheet, relative to the export root. */
export const EXPORT_FONTS_CSS_FILE = join(EXPORT_ASSETS_DIR, 'fonts.css');

/** Prefix for the per-run export staging directory under `exports/`. */
export const EXPORT_STAGING_PREFIX = 'html.tmp-';

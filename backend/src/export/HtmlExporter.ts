import { createWriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { once } from 'node:events';
import {
  RenderModelSchema,
  type ExportResult,
  type ExportSettings,
  type RenderModel,
} from '@chatframe/shared';
import { EXPORT_HTML_FILE } from '../config/paths';
import { exportHtmlDir, exportStagingDir, renderModelPath } from '../projects/ProjectPaths';
import { readJson } from '../storage/JsonFile';
import { copyExportAssets } from './copyExportAssets';
import { renderConversationHtml, type ExportLocale } from './renderConversationHtml';

/**
 * HTML export orchestrator (009 plan; research §7).
 *
 * Reads the project's render model, builds the complete archive in a staging
 * directory (`exports/html.tmp-<runId>/`), and atomically promotes it to
 * `exports/html/` only on full success — a failed or interrupted run never
 * corrupts a prior export. On any error the staging directory is removed and a
 * structured error is rethrown. Raw and normalized data are never modified
 * (Constitution VI).
 */

/** Signals that `normalized/render-model.json` does not exist yet (→ 404). */
export class RenderModelNotFoundError extends Error {
  readonly code = 'RENDER_MODEL_NOT_FOUND';
  constructor() {
    super('No render model exists yet; run normalization first');
    this.name = 'RenderModelNotFoundError';
  }
}

/** Signals a generation/write failure after cleanup (→ 500). User-safe message. */
export class ExportFailedError extends Error {
  readonly code = 'EXPORT_FAILED';
  constructor(cause: unknown) {
    super('Export failed while writing files');
    this.name = 'ExportFailedError';
    this.cause = cause;
  }
}

export interface HtmlExportOptions {
  projectId: string;
  /** Absolute project directory. */
  projectDir: string;
  settings: ExportSettings;
  locale: ExportLocale;
  /** In-memory render model override (mock mode); skips the disk read. */
  model?: RenderModel;
  /** Source stylesheet override (tests only). */
  stylesheetPath?: string;
}

/** Project-relative response paths (POSIX separators, Constitution XIX). */
const EXPORT_DIR_RELATIVE = 'exports/html';
const HTML_FILE_RELATIVE = 'exports/html/conversation.html';

/** Loads and validates the render model, mapping ENOENT to the 404 error. */
async function loadRenderModel(projectDir: string): Promise<RenderModel> {
  try {
    return await readJson(renderModelPath(projectDir), RenderModelSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new RenderModelNotFoundError();
    }
    throw error;
  }
}

/** Streams the conversation document into the staging directory. */
async function writeConversationHtml(
  model: RenderModel,
  settings: ExportSettings,
  locale: ExportLocale,
  stagingDir: string,
): Promise<number> {
  const htmlPath = join(stagingDir, EXPORT_HTML_FILE);
  const out = createWriteStream(htmlPath, { encoding: 'utf8' });
  try {
    await renderConversationHtml(model, { settings, locale }, out);
  } finally {
    out.end();
    await once(out, 'close');
  }
  return (await stat(htmlPath)).size;
}

/**
 * Runs the full export and returns its {@link ExportResult}. The caller owns
 * the per-project export lock (`exportRegistry`).
 */
export async function exportHtml(options: HtmlExportOptions): Promise<ExportResult> {
  const { projectId, projectDir, settings, locale } = options;
  const startedAt = Date.now();

  const model = options.model ?? (await loadRenderModel(projectDir));

  const runId = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  const stagingDir = exportStagingDir(projectDir, runId);
  const targetDir = exportHtmlDir(projectDir);

  try {
    await mkdir(stagingDir, { recursive: true });

    const htmlSize = await writeConversationHtml(model, settings, locale, stagingDir);
    const assets = await copyExportAssets({
      projectDir,
      exportRoot: stagingDir,
      model,
      ...(options.stylesheetPath !== undefined ? { stylesheetPath: options.stylesheetPath } : {}),
    });

    // Atomic promote: replace any prior export wholesale (FR-020). The staging
    // dir is a sibling of the target, so `rename` stays on one volume.
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(dirname(targetDir), { recursive: true });
    await rename(stagingDir, targetDir);

    return {
      projectId,
      exportDir: EXPORT_DIR_RELATIVE,
      htmlFilePath: HTML_FILE_RELATIVE,
      imageCount: assets.imageCount,
      totalAssetSize: assets.totalAssetSize + htmlSize,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  } catch (error) {
    // Never leave a half-written archive behind; the prior export (if any)
    // remains intact (research §7).
    await rm(stagingDir, { recursive: true, force: true });
    throw new ExportFailedError(error);
  }
}

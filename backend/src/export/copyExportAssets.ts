import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderModel } from '@chatframe/shared';
import {
  EXPORT_FONTS_CSS_FILE,
  EXPORT_FONTS_DIR,
  EXPORT_MEDIA_DIR,
  EXPORT_STYLE_FILE,
} from '../config/paths';
import { DEFAULT_CONCURRENCY, runWithConcurrency } from '../import/concurrency';
import { EXPORT_FONT_FILES, generateFontsCss, resolveFontFilePath } from './fontAssets';

/**
 * Asset copier for the HTML export (009 research §6).
 *
 * Copies `chat-renderer.css` VERBATIM to `assets/style.css` (the SC-008
 * byte-identity contract), writes the generated `assets/fonts.css` and copies
 * the bundled font files into `assets/fonts/`, and copies every image the
 * render model references from the project's `media/images/` into
 * `assets/media/` (filenames preserved) with bounded concurrency. Assets
 * recorded as `missing` are skipped — the renderer shows their placeholder
 * card instead (FR-019).
 */

/**
 * The one source of truth for the export's stylesheet: the preview's
 * `chat-renderer.css`, resolved relative to this module (`backend/src/export/`
 * and `backend/dist/export/` are both three levels below the repo root).
 */
export const CHAT_RENDERER_CSS_PATH = fileURLToPath(
  new URL('../../../frontend/src/styles/chat-renderer.css', import.meta.url),
);

export interface CopyExportAssetsOptions {
  /** Absolute project directory — the source of `media/images/`. */
  projectDir: string;
  /** Absolute export root being built (the staging directory). */
  exportRoot: string;
  /** The render model whose referenced images are copied. */
  model: RenderModel;
  /** Source stylesheet override (tests only). */
  stylesheetPath?: string;
  /** Image-copy parallelism cap. */
  concurrency?: number;
}

export interface CopyExportAssetsResult {
  /** Number of image files copied into `assets/media/` (excludes skipped). */
  imageCount: number;
  /** Total bytes of all asset files this copier wrote under the export root. */
  totalAssetSize: number;
}

/** Last path segment of a (POSIX or Windows) relative path. */
function filenameOf(path: string): string {
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] ?? path;
}

/** One image copy job: absolute source → absolute destination. */
interface ImageCopyJob {
  source: string;
  destination: string;
}

/**
 * Collects the unique, non-missing images the render model references,
 * deduplicated by destination filename. Filenames are reduced to their base
 * name, so no model value can traverse outside the media directories.
 */
function collectImageJobs(
  model: RenderModel,
  projectDir: string,
  mediaDir: string,
): ImageCopyJob[] {
  const byFilename = new Map<string, ImageCopyJob>();
  for (const entry of model.entries) {
    if (entry.kind !== 'message' || entry.image === undefined || entry.image.missing === true) {
      continue;
    }
    const sourceName = filenameOf(entry.image.localPath);
    const destinationName = filenameOf(entry.image.exportPath);
    if (!byFilename.has(destinationName)) {
      byFilename.set(destinationName, {
        source: join(projectDir, 'media', 'images', sourceName),
        destination: join(mediaDir, destinationName),
      });
    }
  }
  return [...byFilename.values()];
}

/**
 * Copies stylesheet, fonts, and referenced images into `exportRoot`. Returns
 * the copied-image count and the total bytes written. A source image that no
 * longer exists on disk is skipped (the archive simply lacks the file, and the
 * render model's `missing` placeholder handling covers tracked absences);
 * any other I/O failure (e.g. disk full) propagates to the orchestrator,
 * which cleans up the staging directory (research §7).
 */
export async function copyExportAssets(
  options: CopyExportAssetsOptions,
): Promise<CopyExportAssetsResult> {
  const {
    projectDir,
    exportRoot,
    model,
    stylesheetPath = CHAT_RENDERER_CSS_PATH,
    concurrency = DEFAULT_CONCURRENCY,
  } = options;

  const styleFile = join(exportRoot, EXPORT_STYLE_FILE);
  const fontsCssFile = join(exportRoot, EXPORT_FONTS_CSS_FILE);
  const fontsDir = join(exportRoot, EXPORT_FONTS_DIR);
  const mediaDir = join(exportRoot, EXPORT_MEDIA_DIR);

  await mkdir(fontsDir, { recursive: true });

  // Stylesheet: a byte-for-byte copy of chat-renderer.css (SC-008).
  await copyFile(stylesheetPath, styleFile);

  // Fonts: generated @font-face rules + the bundled .woff2 files (research §1).
  await writeFile(fontsCssFile, generateFontsCss(), 'utf8');
  for (const font of EXPORT_FONT_FILES) {
    await copyFile(resolveFontFilePath(font), join(fontsDir, font.filename));
  }

  // Images: bounded-concurrency copy of every referenced, non-missing asset.
  const jobs = collectImageJobs(model, projectDir, mediaDir);
  let imageCount = 0;
  if (jobs.length > 0) {
    await mkdir(mediaDir, { recursive: true });
    const results = await runWithConcurrency(jobs, concurrency, async (job) => {
      try {
        await copyFile(job.source, job.destination);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return false; // Source bytes are gone — skip, placeholder covers it.
        }
        throw error;
      }
    });
    for (const result of results) {
      if (!result.ok) {
        throw result.error instanceof Error ? result.error : new Error('Image copy failed');
      }
      if (result.value) {
        imageCount += 1;
      }
    }
  }

  // Total bytes of everything this copier wrote.
  let totalAssetSize = 0;
  const written = [
    styleFile,
    fontsCssFile,
    ...EXPORT_FONT_FILES.map((font) => join(fontsDir, font.filename)),
    ...jobs.map((job) => job.destination),
  ];
  for (const file of written) {
    try {
      totalAssetSize += (await stat(file)).size;
    } catch {
      // Skipped (never-copied) images have no file to measure.
    }
  }

  return { imageCount, totalAssetSize };
}

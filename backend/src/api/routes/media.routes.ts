import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { MEDIA_IMAGES_DIR, PROJECTS_DIR } from '../../config/paths';
import { projectDirPath } from '../../projects/ProjectPaths';

/**
 * `GET /api/media/:projectId/:filename` — streams a stored image from the
 * project's `media/images/` directory with the correct `Content-Type`
 * (008 FR-003, contracts §3).
 *
 * Security (Constitution XIII/XIX, research §4): the filename must match the
 * `MediaStore` naming scheme exactly, and the resolved absolute path is
 * re-checked to stay inside the project's `media/images/` directory before any
 * read. Session files live outside the project tree and are unreachable here
 * by construction. No directory listing is exposed.
 */

/** Allow-list pattern matching `MediaStore`'s `img_000001.jpg` naming scheme. */
const FILENAME_PATTERN = /^img_\d{6,}\.[a-z0-9]+$/;

/** Content types by extension; unknown extensions fall back to octet-stream. */
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
};

/** Derives the response content type from the validated filename. */
function contentTypeFor(filename: string): string {
  const extension = filename.slice(filename.lastIndexOf('.') + 1);
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

/** Decodes a possibly URL-encoded project id without throwing on a literal `%`. */
function decodeProjectId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { projectId: string; filename: string } }>(
    '/api/media/:projectId/:filename',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);
      const { filename } = request.params;

      if (!FILENAME_PATTERN.test(filename)) {
        return reply.status(400).send({
          error: 'INVALID_FILENAME',
          message: 'Filename is not an allowed media file name',
        });
      }

      // Containment check: the resolved path must stay inside the project's
      // media/images/ directory, which itself must stay inside PROJECTS_DIR
      // (a traversing projectId is rejected the same way).
      const imagesDir = resolve(projectDirPath(projectId, PROJECTS_DIR), MEDIA_IMAGES_DIR);
      const candidate = resolve(imagesDir, filename);
      if (
        !imagesDir.startsWith(resolve(PROJECTS_DIR) + sep) ||
        !candidate.startsWith(imagesDir + sep)
      ) {
        return reply.status(400).send({
          error: 'INVALID_FILENAME',
          message: 'Filename is not an allowed media file name',
        });
      }

      let size: number;
      try {
        const info = await stat(candidate);
        if (!info.isFile()) {
          throw Object.assign(new Error('not a file'), { code: 'ENOENT' });
        }
        size = info.size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return reply.status(404).send({
            error: 'MEDIA_NOT_FOUND',
            message: 'No media file found for the given name',
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: 'MEDIA_ERROR',
          message: 'Failed to read the media file',
        });
      }

      // Stream the bytes — never buffer whole files (Constitution XVIII).
      // Filenames are sequential and content-stable, so a long-lived local
      // cache hint is safe (contracts §3).
      return reply
        .header('Content-Type', contentTypeFor(filename))
        .header('Content-Length', size)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(createReadStream(candidate));
    },
  );
}

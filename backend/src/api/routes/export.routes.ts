import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import {
  ExportHtmlRequestSchema,
  ExportResultSchema,
  type Participant,
  type RenderModel,
} from '@chatframe/shared';
import { env } from '../../config/env';
import { PROJECTS_DIR } from '../../config/paths';
import { exportHtmlDir, projectDirPath } from '../../projects/ProjectPaths';
import { buildRenderModel } from '../../normalization/RenderModelBuilder';
import { mockMessages } from '../../whatsapp/fixtures/mock-messages';
import { exportHtml, RenderModelNotFoundError } from '../../export/HtmlExporter';
import {
  acquireExportLock,
  ExportInProgressError,
  releaseExportLock,
} from '../../export/exportRegistry';
import { ExportError } from '../../utils/errors';
import { formatZodIssues } from '../errors';

/**
 * HTML export API (009 contracts/export-api.md §1).
 *
 * `POST /api/projects/:projectId/export/html` generates the self-contained
 * offline archive and returns an `ExportResult` (FR-001). One export runs per
 * project at a time (FR-021 → 409). Request and response are Zod-validated at
 * the boundary (FR-018). Logs carry only non-sensitive metadata — never
 * message content, contact identities, or session data (FR-025, research §10).
 */

/** Decodes a possibly URL-encoded project id without throwing on a literal `%`. */
function decodeProjectId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Derives the fixture participants from the mock conversation (mock mode). */
function mockParticipants(): Participant[] {
  const byId = new Map<string, Participant>();
  for (const message of mockMessages) {
    const displayName = message.senderDisplayName;
    if (displayName !== undefined && displayName.length > 0) {
      byId.set(message.senderId, {
        id: message.senderId,
        displayName,
        isMe: message.isFromMe,
      });
    }
  }
  return [...byId.values()];
}

/** Builds the in-memory render model for the synthetic fixture conversation. */
function mockRenderModel(projectId: string): RenderModel {
  const messages = [...mockMessages].sort((a, b) => a.timestampIso.localeCompare(b.timestampIso));
  return buildRenderModel(messages, {
    projectId,
    chatId: messages[0]?.chatId ?? 'chat-001',
    participants: mockParticipants(),
  });
}

/** Content types for the files an export tree can contain (data-model §4). */
const EXPORT_CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  woff2: 'font/woff2',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
};

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  // Read-only file streaming from the promoted export so "Open HTML" can open
  // the archive in a browser tab (FR-015) without the frontend ever touching
  // the filesystem (Constitution XV). Path containment mirrors media.routes.
  app.get<{ Params: { projectId: string; '*': string } }>(
    '/api/projects/:projectId/export/files/*',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);
      const relativePath = request.params['*'];

      const exportRoot = resolve(exportHtmlDir(projectDirPath(projectId, PROJECTS_DIR)));
      const candidate = resolve(exportRoot, relativePath);
      if (
        !exportRoot.startsWith(resolve(PROJECTS_DIR) + sep) ||
        !candidate.startsWith(exportRoot + sep)
      ) {
        return reply.status(400).send({
          error: 'PATH_NOT_ALLOWED',
          message: 'Path is not within the export directory',
        });
      }

      const extension = candidate.slice(candidate.lastIndexOf('.') + 1).toLowerCase();
      const contentType = EXPORT_CONTENT_TYPES[extension];
      if (contentType === undefined) {
        return reply.status(400).send({
          error: 'PATH_NOT_ALLOWED',
          message: 'Path is not within the export directory',
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
            error: 'EXPORT_FILE_NOT_FOUND',
            message: 'No export file found for the given path',
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: 'EXPORT_FILE_ERROR',
          message: 'Failed to read the export file',
        });
      }

      return reply
        .header('Content-Type', contentType)
        .header('Content-Length', size)
        .send(createReadStream(candidate));
    },
  );

  app.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/export/html',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);

      const parsed = ExportHtmlRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(422).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid export settings',
          details: formatZodIssues(parsed.error),
        });
      }
      const { settings, locale } = parsed.data;

      try {
        acquireExportLock(projectId);
      } catch (error) {
        if (error instanceof ExportInProgressError) {
          return reply.status(409).send({
            error: 'EXPORT_IN_PROGRESS',
            message: 'An export is already in progress for this project',
          });
        }
        throw error;
      }

      try {
        const projectDir = projectDirPath(projectId, PROJECTS_DIR);

        // Mock mode exports the synthetic fixture conversation so the full
        // flow is exercisable without a real import (contracts §1).
        let model: RenderModel | undefined;
        if (env.MOCK_MODE) {
          model = mockRenderModel(projectId);
          await mkdir(projectDir, { recursive: true });
        }

        const result = await exportHtml({
          projectId,
          projectDir,
          settings,
          locale,
          ...(model !== undefined ? { model } : {}),
        });

        // Sanitized logging only: settings flags, counts, timing (FR-025).
        app.log.info(
          {
            projectId,
            theme: settings.theme,
            showContactName: settings.showContactName,
            showPhoneNumber: settings.showPhoneNumber,
            showWatermark: settings.showWatermark,
            hasAlias: settings.displayAlias !== undefined,
            locale,
            imageCount: result.imageCount,
            totalAssetSize: result.totalAssetSize,
            durationMs: result.durationMs,
          },
          'html export completed',
        );

        return ExportResultSchema.parse(result);
      } catch (error) {
        if (error instanceof RenderModelNotFoundError) {
          return reply.status(404).send({
            error: 'RENDER_MODEL_NOT_FOUND',
            message: 'No render model exists yet; run normalization first',
          });
        }
        // Log only the error type/message chain — never content (FR-025).
        app.log.error(
          { projectId, err: error instanceof Error ? error.message : 'unknown' },
          'html export failed',
        );
        if (error instanceof ExportError) {
          return reply.status(500).send({
            error: error.code,
            message: 'Could not complete export. Check disk space and try again.',
          });
        }
        return reply.status(500).send({
          error: 'EXPORT_FAILED',
          message: 'Could not complete export. Check disk space and try again.',
        });
      } finally {
        releaseExportLock(projectId);
      }
    },
  );
}

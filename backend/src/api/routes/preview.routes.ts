import type { FastifyInstance, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import {
  PaginatedPreviewResponseSchema,
  PreviewCountResponseSchema,
  PreviewQuerySchema,
  RenderModelSchema,
  type Participant,
  type PrivacySettings,
  type RenderModel,
} from '@chatframe/shared';
import { stat } from 'node:fs/promises';
import { env } from '../../config/env';
import { PROJECTS_DIR } from '../../config/paths';
import { projectDirPath, renderModelPath } from '../../projects/ProjectPaths';
import { readJson } from '../../storage/JsonFile';
import { ManifestValidationError } from '../../utils/errors';
import { buildRenderModel } from '../../normalization/RenderModelBuilder';
import { paginateRenderModel } from '../../preview/paginateRenderModel';
import { applyPreviewPrivacy } from '../../preview/previewPrivacy';
import { mockMessages } from '../../whatsapp/fixtures/mock-messages';
import { toValidationErrorBody } from '../errors';

/**
 * Paginated preview API (008 contracts/preview-api.md).
 *
 * `GET /api/projects/:projectId/preview` serves a privacy-applied
 * offset/limit slice of the conversation's message rows (FR-001, FR-004);
 * `GET .../preview/count` returns the total row count that sizes the virtual
 * scroll area (FR-002). In mock mode both endpoints page over the synthetic
 * fixture conversation regardless of `projectId`, so the whole screen is
 * buildable without a real import.
 */

/** Decodes a possibly URL-encoded project id without throwing on a literal `%`. */
function decodeProjectId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Returns true when the project folder exists. */
async function projectExists(projectDir: string): Promise<boolean> {
  try {
    return (await stat(projectDir)).isDirectory();
  } catch {
    return false;
  }
}

/** Derives the fixture participants from the mock conversation. */
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

/**
 * Loads the render model for a project, replying with a structured error and
 * returning `null` when it cannot be served (Constitution XIX).
 */
async function loadRenderModel(
  app: FastifyInstance,
  projectId: string,
  reply: FastifyReply,
): Promise<RenderModel | null> {
  if (env.MOCK_MODE) {
    return mockRenderModel(projectId);
  }

  const projectDir = projectDirPath(projectId, PROJECTS_DIR);
  if (!(await projectExists(projectDir))) {
    reply.status(404).send({
      error: 'PROJECT_NOT_FOUND',
      message: `Project '${projectId}' not found`,
    });
    return null;
  }

  try {
    return await readJson(renderModelPath(projectDir), RenderModelSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      reply.status(404).send({
        error: 'RENDER_MODEL_NOT_FOUND',
        message: 'No render model exists yet; run normalization first',
      });
      return null;
    }
    if (error instanceof ManifestValidationError) {
      reply.status(422).send({
        error: 'RENDER_MODEL_VALIDATION_ERROR',
        message: error.message,
        details: error.details,
      });
      return null;
    }
    app.log.error(error);
    reply.status(500).send({
      error: 'STORAGE_ERROR',
      message: 'Failed to read the render model',
    });
    return null;
  }
}

export async function previewRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/projects/:projectId/preview — paginated, privacy-applied slice.
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/preview',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);

      const parsedQuery = PreviewQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: 'INVALID_QUERY',
          message: parsedQuery.error.issues
            .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; '),
        });
      }
      const { offset, limit, showContactName, showPhoneNumber, displayAlias } = parsedQuery.data;
      const privacy: PrivacySettings = {
        showContactName,
        showPhoneNumber,
        ...(displayAlias !== undefined ? { displayAlias } : {}),
      };

      const model = await loadRenderModel(app, projectId, reply);
      if (model === null) {
        return reply;
      }

      try {
        const { messages, totalRows } = paginateRenderModel(model, offset, limit);
        const applied = applyPreviewPrivacy(model.participants, messages, privacy);

        const body = PaginatedPreviewResponseSchema.parse({
          projectId,
          chatId: model.chatId,
          participants: applied.participants,
          messages: applied.messages,
          offset,
          limit,
          totalRows,
          appliedPrivacy: applied.appliedPrivacy,
        });
        return body;
      } catch (error) {
        app.log.error(error);
        if (error instanceof ZodError) {
          return reply
            .status(500)
            .send(toValidationErrorBody(error, 'Conversation preview failed schema validation'));
        }
        return reply.status(500).send({
          error: 'PREVIEW_ERROR',
          message: 'Failed to load conversation preview',
        });
      }
    },
  );

  // GET /api/projects/:projectId/preview/count — total message rows (FR-002).
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/preview/count',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);

      const model = await loadRenderModel(app, projectId, reply);
      if (model === null) {
        return reply;
      }

      try {
        const { totalRows } = paginateRenderModel(model, 0, 0);
        const body = PreviewCountResponseSchema.parse({ projectId, totalMessages: totalRows });
        return body;
      } catch (error) {
        app.log.error(error);
        if (error instanceof ZodError) {
          return reply
            .status(500)
            .send(toValidationErrorBody(error, 'Preview count failed schema validation'));
        }
        return reply.status(500).send({
          error: 'PREVIEW_ERROR',
          message: 'Failed to count conversation messages',
        });
      }
    },
  );
}

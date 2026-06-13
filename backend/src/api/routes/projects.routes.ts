import type { FastifyInstance } from 'fastify';
import { CreateProjectRequestSchema, RenameProjectRequestSchema } from '@chatframe/shared';
import { createProject, readProject, renameProject } from '../../projects/ProjectStore';
import { ManifestValidationError, ProjectNotFoundError, StorageError } from '../../utils/errors';
import { formatZodIssues } from '../errors';

/**
 * Project CRUD endpoints (contracts/projects.md). All storage logic is
 * backend-only (Constitution XV); the frontend communicates exclusively through
 * these HTTP endpoints. Error responses follow the shared
 * `{ error, message, details? }` shape.
 */
export async function projectsRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/projects — create a new project folder (FR-018, SC-001).
  app.post('/api/projects', async (request, reply) => {
    const parsed = CreateProjectRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: formatZodIssues(parsed.error),
      });
    }

    try {
      const result = await createProject(parsed.data);
      return reply.status(201).send(result);
    } catch (error) {
      app.log.error(error);
      if (error instanceof StorageError) {
        return reply.status(500).send({
          error: error.code,
          message: error.message,
        });
      }
      return reply.status(500).send({
        error: 'STORAGE_ERROR',
        message: 'Failed to create project',
      });
    }
  });

  // GET /api/projects/:projectId — retrieve a project's manifest (FR-011).
  app.get<{ Params: { projectId: string } }>('/api/projects/:projectId', async (request, reply) => {
    // Fastify already percent-decodes path params; guard a second decode so a
    // literal '%' in a folder name does not throw a URIError.
    const raw = request.params.projectId;
    let projectId = raw;
    try {
      projectId = decodeURIComponent(raw);
    } catch {
      projectId = raw;
    }

    try {
      const manifest = await readProject(projectId);
      return reply.status(200).send(manifest);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        return reply.status(404).send({
          error: error.code,
          message: error.message,
        });
      }
      if (error instanceof ManifestValidationError) {
        return reply.status(422).send({
          error: error.code,
          message: error.message,
          details: error.details,
        });
      }
      app.log.error(error);
      if (error instanceof StorageError) {
        return reply.status(500).send({
          error: error.code,
          message: error.message,
        });
      }
      return reply.status(500).send({
        error: 'STORAGE_ERROR',
        message: 'Failed to read project',
      });
    }
  });

  // PATCH /api/projects/:projectId — rename a project's display name (FR-012).
  app.patch<{ Params: { projectId: string } }>(
    '/api/projects/:projectId',
    async (request, reply) => {
      const raw = request.params.projectId;
      let projectId = raw;
      try {
        projectId = decodeURIComponent(raw);
      } catch {
        projectId = raw;
      }

      const parsed = RenameProjectRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: formatZodIssues(parsed.error),
        });
      }

      try {
        const result = await renameProject(projectId, parsed.data.displayName);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          return reply.status(404).send({
            error: error.code,
            message: error.message,
          });
        }
        if (error instanceof ManifestValidationError) {
          return reply.status(422).send({
            error: error.code,
            message: error.message,
            details: error.details,
          });
        }
        app.log.error(error);
        if (error instanceof StorageError) {
          return reply.status(500).send({
            error: error.code,
            message: error.message,
          });
        }
        return reply.status(500).send({
          error: 'STORAGE_ERROR',
          message: 'Failed to rename project',
        });
      }
    },
  );
}

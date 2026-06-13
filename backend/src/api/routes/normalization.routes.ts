import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import {
  QualityReportSchema,
  RenderModelSchema,
  type NormalizeRunResponse,
} from '@chatframe/shared';
import { PROJECTS_DIR } from '../../config/paths';
import {
  projectDirPath,
  qualityReportPath,
  rawMessagesPath,
  renderModelPath,
} from '../../projects/ProjectPaths';
import { readJson } from '../../storage/JsonFile';
import { ManifestValidationError, NormalizationError } from '../../utils/errors';
import { runNormalizationPipeline } from '../../normalization/NormalizationPipeline';
import { NormalizationInProgressError, getStatus, startRun } from '../../normalization/runRegistry';

/**
 * Normalization API (contracts/normalization.md). Backend-only; the frontend
 * triggers runs and polls status through these endpoints (FR-016, FR-020).
 * The render-model endpoint is added in a later phase (US5).
 */

/** Decodes a possibly URL-encoded project id without throwing on a literal `%`. */
function decodeProjectId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Returns true when the raw NDJSON exists and is non-empty. */
async function hasRawData(projectDir: string): Promise<boolean> {
  try {
    const info = await stat(rawMessagesPath(projectDir));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
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

export async function normalizationRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/projects/:projectId/normalize — run (or re-run) normalization.
  app.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/normalize',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);
      const projectDir = projectDirPath(projectId, PROJECTS_DIR);

      if (!(await projectExists(projectDir))) {
        return reply.status(404).send({
          error: 'PROJECT_NOT_FOUND',
          message: `Project '${projectId}' not found`,
        });
      }

      if (!(await hasRawData(projectDir))) {
        return reply.status(422).send({
          error: 'NO_RAW_DATA',
          message: 'raw/messages.raw.ndjson is missing or empty',
        });
      }

      try {
        const status = startRun(projectId, (report) =>
          runNormalizationPipeline({ projectDir, projectId, onStep: report }).then(() => undefined),
        );
        const body: NormalizeRunResponse = {
          projectId,
          state: status.state,
          startedAt: status.startedAt ?? new Date().toISOString(),
          currentStep: status.currentStep,
        };
        return reply.status(202).send(body);
      } catch (error) {
        if (error instanceof NormalizationInProgressError) {
          return reply.status(409).send({ error: error.code, message: error.message });
        }
        app.log.error(error);
        if (error instanceof NormalizationError) {
          return reply.status(500).send({
            error: error.code,
            message: 'Message processing encountered an error. Raw data is preserved.',
          });
        }
        return reply.status(500).send({
          error: 'STORAGE_ERROR',
          message: 'Failed to start normalization',
        });
      }
    },
  );

  // GET /api/projects/:projectId/normalization/status — current run state.
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/normalization/status',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);
      const projectDir = projectDirPath(projectId, PROJECTS_DIR);

      if (!(await projectExists(projectDir))) {
        return reply.status(404).send({
          error: 'PROJECT_NOT_FOUND',
          message: `Project '${projectId}' not found`,
        });
      }

      return reply.status(200).send(getStatus(projectId));
    },
  );

  // GET /api/projects/:projectId/quality-report — the generated report.
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/quality-report',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);
      const projectDir = projectDirPath(projectId, PROJECTS_DIR);

      if (!(await projectExists(projectDir))) {
        return reply.status(404).send({
          error: 'PROJECT_NOT_FOUND',
          message: `Project '${projectId}' not found`,
        });
      }

      try {
        const report = await readJson(qualityReportPath(projectDir), QualityReportSchema);
        return reply.status(200).send(report);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return reply.status(404).send({
            error: 'QUALITY_REPORT_NOT_FOUND',
            message: 'No quality report exists yet; run normalization first',
          });
        }
        if (error instanceof ManifestValidationError) {
          return reply.status(422).send({
            error: 'QUALITY_REPORT_VALIDATION_ERROR',
            message: error.message,
            details: error.details,
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: 'STORAGE_ERROR',
          message: 'Failed to read the quality report',
        });
      }
    },
  );

  // GET /api/projects/:projectId/render-model — the preview-ready render model.
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/render-model',
    async (request, reply) => {
      const projectId = decodeProjectId(request.params.projectId);
      const projectDir = projectDirPath(projectId, PROJECTS_DIR);

      if (!(await projectExists(projectDir))) {
        return reply.status(404).send({
          error: 'PROJECT_NOT_FOUND',
          message: `Project '${projectId}' not found`,
        });
      }

      try {
        const model = await readJson(renderModelPath(projectDir), RenderModelSchema);
        return reply.status(200).send(model);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return reply.status(404).send({
            error: 'RENDER_MODEL_NOT_FOUND',
            message: 'No render model exists yet; run normalization first',
          });
        }
        if (error instanceof ManifestValidationError) {
          return reply.status(422).send({
            error: 'RENDER_MODEL_VALIDATION_ERROR',
            message: error.message,
            details: error.details,
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: 'STORAGE_ERROR',
          message: 'Failed to read the render model',
        });
      }
    },
  );
}

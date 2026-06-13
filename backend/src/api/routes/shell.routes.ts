import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { ShellOpenFolderRequestSchema } from '@chatframe/shared';
import { EXPORTS_DIR, PROJECTS_DIR } from '../../config/paths';
import { projectDirPath } from '../../projects/ProjectPaths';
import { formatZodIssues } from '../errors';

/**
 * `POST /api/shell/open-folder` — opens the OS file explorer at a directory
 * constrained to the project's `exports/` directory (009 contracts §2,
 * FR-016, FR-027).
 *
 * Security (research §9, Constitution XIX): the requested path is resolved and
 * asserted to stay inside `<projectDir>/exports/` (absolute-prefix
 * containment, mirroring the media route), and the launcher is invoked via
 * `child_process.spawn` with an ARGUMENT ARRAY — never a shell string, never
 * `exec`, never `shell: true`.
 */

/** Platform → file-manager launcher. Anything else reports `opened: false`. */
const LAUNCHERS: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'explorer.exe',
  darwin: 'open',
  linux: 'xdg-open',
};

/** Returns true when the project folder exists. */
async function projectExists(projectDir: string): Promise<boolean> {
  try {
    return (await stat(projectDir)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Launches the file manager detached. Resolves once the process has spawned;
 * rejects on a spawn failure (e.g. missing launcher binary). Exit codes are
 * deliberately ignored — `explorer.exe` returns non-zero even on success.
 */
function launchDetached(command: string, target: string): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, [target], { stdio: 'ignore', detached: true });
    child.once('error', rejectPromise);
    child.once('spawn', () => {
      child.unref();
      resolvePromise();
    });
  });
}

export async function shellRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/shell/open-folder', async (request, reply) => {
    const parsed = ShellOpenFolderRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        message: 'Invalid open-folder request',
        details: formatZodIssues(parsed.error),
      });
    }
    const { projectId, path } = parsed.data;

    const projectDir = resolve(projectDirPath(projectId, PROJECTS_DIR));
    // A traversing projectId is rejected the same way as a traversing path.
    if (!projectDir.startsWith(resolve(PROJECTS_DIR) + sep)) {
      return reply.status(400).send({
        error: 'PATH_NOT_ALLOWED',
        message: "Path is not within the project's exports directory",
      });
    }

    if (!(await projectExists(projectDir))) {
      return reply.status(404).send({
        error: 'PROJECT_NOT_FOUND',
        message: `Project '${projectId}' not found`,
      });
    }

    // Containment: the resolved target must be exports/ itself or inside it.
    const exportsRoot = resolve(projectDir, EXPORTS_DIR);
    const candidate = isAbsolute(path) ? resolve(path) : resolve(projectDir, path);
    if (candidate !== exportsRoot && !candidate.startsWith(exportsRoot + sep)) {
      return reply.status(400).send({
        error: 'PATH_NOT_ALLOWED',
        message: "Path is not within the project's exports directory",
      });
    }

    const launcher = LAUNCHERS[process.platform];
    if (launcher === undefined) {
      // Unsupported platform: the UI hides/disables the button (contracts §2).
      return { opened: false };
    }

    try {
      await launchDetached(launcher, candidate);
      return { opened: true };
    } catch (error) {
      app.log.error(
        { err: error instanceof Error ? error.message : 'unknown' },
        'shell open-folder failed',
      );
      return reply.status(500).send({
        error: 'SHELL_ERROR',
        message: 'Failed to open the folder',
      });
    }
  });
}

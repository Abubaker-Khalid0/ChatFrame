import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  ProjectManifest,
  ProjectManifestResponse,
  RenameProjectResponse,
  SourceMetadata,
} from '@chatframe/shared';
import { PROJECTS_DIR } from '../config/paths';
import { ProjectNotFoundError, StorageError } from '../utils/errors';
import { buildFolderName, checkPathLength, dedupeFolderName } from './ProjectPaths';
import { buildManifest, readManifest, writeManifest, writeSource } from './ProjectManifest';

/**
 * Create, read, and rename projects on the local filesystem. Each project is a
 * self-contained folder named `chatframe_YYYY-MM-DD_<slug>` (FR-001, FR-002,
 * SC-001).
 */

/** The subdirectories scaffolded inside every new project folder (FR-002). */
const PROJECT_SUBDIRS = [
  'raw',
  'normalized',
  join('media', 'images'),
  join('exports', 'html', 'assets'),
  'logs',
] as const;

/** Options for {@link createProject}, primarily to make it testable. */
export interface CreateProjectOptions {
  /** Directory that holds all project folders. Defaults to {@link PROJECTS_DIR}. */
  projectsDir?: string;
  /** Clock injection for deterministic folder dates/timestamps. */
  now?: Date;
}

/** Derives a human-readable display name from the available chat identifiers. */
function resolveDisplayName(input: CreateProjectRequest): string {
  return input.chatDisplayName ?? input.chatPhoneNumber ?? input.chatId;
}

/** Lists existing folder names under `projectsDir`, tolerating a missing dir. */
async function listExistingFolders(projectsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new StorageError('Failed to read the projects directory');
  }
}

/**
 * Creates a new project folder with a validated manifest and immutable source
 * metadata, returning the new project's identity plus any non-blocking
 * warnings (e.g. a long path). The folder name IS the project ID.
 */
export async function createProject(
  input: CreateProjectRequest,
  options: CreateProjectOptions = {},
): Promise<CreateProjectResponse> {
  const projectsDir = options.projectsDir ?? PROJECTS_DIR;
  const now = options.now ?? new Date();
  const createdAt = now.toISOString();
  const date = createdAt.slice(0, 10); // YYYY-MM-DD

  const displayName = resolveDisplayName(input);
  const desiredFolder = buildFolderName(date, displayName);

  const existing = await listExistingFolders(projectsDir);
  const projectId = dedupeFolderName(desiredFolder, existing);
  const projectDir = join(projectsDir, projectId);

  const warning = checkPathLength(projectDir);
  const warnings = warning ? [warning] : [];

  try {
    await mkdir(projectDir, { recursive: true });
    await Promise.all(
      PROJECT_SUBDIRS.map((subdir) => mkdir(join(projectDir, subdir), { recursive: true })),
    );
  } catch {
    throw new StorageError(`Failed to create project folder '${projectId}'`);
  }

  const manifest = buildManifest({
    displayName,
    createdAt,
    chatId: input.chatId,
    chatDisplayName: input.chatDisplayName,
    chatPhoneNumber: input.chatPhoneNumber,
  });

  const source: SourceMetadata = {
    adapter: input.adapter,
    chatId: input.chatId,
    chatDisplayName: input.chatDisplayName,
    importedAt: createdAt,
    adapterVersion: input.adapterVersion ?? null,
  };

  await writeManifest(projectDir, manifest);
  await writeSource(projectDir, source);

  return {
    projectId,
    displayName,
    createdAt,
    status: 'created',
    warnings,
  };
}

/** Options for {@link readProject}, primarily to make it testable. */
export interface ReadProjectOptions {
  /** Directory that holds all project folders. Defaults to {@link PROJECTS_DIR}. */
  projectsDir?: string;
}

/**
 * Reads and validates a project's manifest by its folder-name ID (FR-011).
 * Returns the full manifest plus the `projectId`. Throws
 * {@link ProjectNotFoundError} when no manifest exists for the ID, and
 * {@link ManifestValidationError} (from the JSON layer) when the manifest is
 * present but malformed — the route layer maps these to 404 / 422.
 */
export async function readProject(
  projectId: string,
  options: ReadProjectOptions = {},
): Promise<ProjectManifestResponse> {
  const projectsDir = options.projectsDir ?? PROJECTS_DIR;
  const projectDir = join(projectsDir, projectId);

  let manifest: ProjectManifest;
  try {
    manifest = await readManifest(projectDir);
  } catch (error) {
    // A missing folder or missing project.json both mean "not found"; a
    // malformed manifest surfaces as a ManifestValidationError and propagates.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ProjectNotFoundError(projectId);
    }
    throw error;
  }

  return { ...manifest, projectId };
}

/** Options for {@link renameProject}, primarily to make it testable. */
export interface RenameProjectOptions {
  /** Directory that holds all project folders. Defaults to {@link PROJECTS_DIR}. */
  projectsDir?: string;
  /** Clock injection for a deterministic `updatedAt`. */
  now?: Date;
}

/**
 * Updates only a project's `displayName`, leaving the folder name (= project
 * ID) and every other field untouched (FR-012). Reads + validates the current
 * manifest first, so it throws {@link ProjectNotFoundError} for an unknown ID
 * and {@link ManifestValidationError} when the on-disk manifest is malformed or
 * the new name violates the schema (empty / too long).
 */
export async function renameProject(
  projectId: string,
  displayName: string,
  options: RenameProjectOptions = {},
): Promise<RenameProjectResponse> {
  const projectsDir = options.projectsDir ?? PROJECTS_DIR;
  const projectDir = join(projectsDir, projectId);

  const current = await readProject(projectId, { projectsDir });
  const { projectId: _id, ...manifest } = current;

  // validate-then-write happens inside writeManifest; only displayName changes.
  await writeManifest(projectDir, { ...manifest, displayName });

  const updatedAt = (options.now ?? new Date()).toISOString();
  return { projectId, displayName, updatedAt };
}

import { join } from 'node:path';
import {
  ProjectManifestSchema,
  SourceMetadataSchema,
  type ProjectManifest,
  type SourceMetadata,
} from '@chatframe/shared';
import { readJson, writeJson } from '../storage/JsonFile';

/**
 * Read/write helpers for the two metadata files at a project's root:
 * `project.json` (the mutable {@link ProjectManifest}) and `source.json` (the
 * immutable {@link SourceMetadata}). Both go through validated JSON I/O
 * (FR-003, FR-004, FR-005, Constitution XIV).
 */

const MANIFEST_FILE = 'project.json';
const SOURCE_FILE = 'source.json';

/** Absolute path to a project's `project.json`. */
export function manifestPath(projectDir: string): string {
  return join(projectDir, MANIFEST_FILE);
}

/** Absolute path to a project's `source.json`. */
export function sourcePath(projectDir: string): string {
  return join(projectDir, SOURCE_FILE);
}

/** Inputs needed to construct a fresh manifest for a newly created project. */
export interface NewManifestInput {
  displayName: string;
  createdAt: string;
  chatId: string;
  chatDisplayName: string | null;
  chatPhoneNumber: string | null;
}

/**
 * Builds a fresh {@link ProjectManifest} in the `created` state. Counts and
 * `importedAt` are null until an import completes (data-model.md).
 */
export function buildManifest(input: NewManifestInput): ProjectManifest {
  return {
    displayName: input.displayName,
    createdAt: input.createdAt,
    chatId: input.chatId,
    chatDisplayName: input.chatDisplayName,
    chatPhoneNumber: input.chatPhoneNumber,
    importedAt: null,
    messageCount: null,
    imageCount: null,
    status: 'created',
  };
}

/** Validates and writes `project.json` into `projectDir`. */
export async function writeManifest(
  projectDir: string,
  manifest: ProjectManifest,
): Promise<ProjectManifest> {
  return writeJson(manifestPath(projectDir), ProjectManifestSchema, manifest);
}

/**
 * Validates and writes the immutable `source.json` into `projectDir`. This file
 * is written once at creation and never modified afterwards (FR-005).
 */
export async function writeSource(
  projectDir: string,
  source: SourceMetadata,
): Promise<SourceMetadata> {
  return writeJson(sourcePath(projectDir), SourceMetadataSchema, source);
}

/** Reads and validates `project.json` from `projectDir`. */
export async function readManifest(projectDir: string): Promise<ProjectManifest> {
  return readJson(manifestPath(projectDir), ProjectManifestSchema);
}

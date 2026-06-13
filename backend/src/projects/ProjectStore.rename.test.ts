import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreateProjectRequest } from '@chatframe/shared';
import { ManifestValidationError, ProjectNotFoundError } from '../utils/errors';
import { createProject, readProject, renameProject } from './ProjectStore';

const baseRequest: CreateProjectRequest = {
  chatId: '201234567890@c.us',
  chatDisplayName: 'أحمد',
  chatPhoneNumber: '+201234567890',
  adapter: 'whatsapp-web.js',
  adapterVersion: '1.0.0',
};

const FIXED_NOW = new Date('2026-06-10T09:30:00.000Z');

let projectsDir: string;

beforeEach(async () => {
  projectsDir = await mkdtemp(join(tmpdir(), 'chatframe-rename-'));
});

afterEach(async () => {
  await rm(projectsDir, { recursive: true, force: true });
});

describe('renameProject (FR-012)', () => {
  it('updates only the displayName and leaves the folder name intact', async () => {
    const created = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });
    const before = await readdir(projectsDir);

    const result = await renameProject(created.projectId, 'My Chat with Ahmed', {
      projectsDir,
      now: FIXED_NOW,
    });

    expect(result.projectId).toBe(created.projectId);
    expect(result.displayName).toBe('My Chat with Ahmed');
    expect(result.updatedAt).toBe(FIXED_NOW.toISOString());

    // Folder name (= project ID) is unchanged on disk.
    expect(await readdir(projectsDir)).toEqual(before);

    // The manifest reflects the new name; other fields are untouched.
    const manifest = await readProject(created.projectId, { projectsDir });
    expect(manifest.displayName).toBe('My Chat with Ahmed');
    expect(manifest.chatId).toBe('201234567890@c.us');
    expect(manifest.status).toBe('created');
  });

  it('throws ProjectNotFoundError for an unknown id', async () => {
    await expect(
      renameProject('chatframe_2026-06-10_missing', 'New Name', { projectsDir }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('rejects an empty display name', async () => {
    const created = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });
    await expect(renameProject(created.projectId, '', { projectsDir })).rejects.toBeInstanceOf(
      ManifestValidationError,
    );
  });

  it('rejects a display name longer than 200 characters', async () => {
    const created = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });
    await expect(
      renameProject(created.projectId, 'x'.repeat(201), { projectsDir }),
    ).rejects.toBeInstanceOf(ManifestValidationError);
  });
});

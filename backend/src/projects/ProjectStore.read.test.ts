import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreateProjectRequest } from '@chatframe/shared';
import { ManifestValidationError, ProjectNotFoundError } from '../utils/errors';
import { manifestPath } from './ProjectManifest';
import { createProject, readProject } from './ProjectStore';

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
  projectsDir = await mkdtemp(join(tmpdir(), 'chatframe-read-'));
});

afterEach(async () => {
  await rm(projectsDir, { recursive: true, force: true });
});

describe('readProject (FR-011)', () => {
  it('returns the validated manifest plus the projectId when found', async () => {
    const created = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });

    const manifest = await readProject(created.projectId, { projectsDir });

    expect(manifest.projectId).toBe(created.projectId);
    expect(manifest.displayName).toBe('أحمد');
    expect(manifest.chatId).toBe('201234567890@c.us');
    expect(manifest.status).toBe('created');
    expect(manifest.messageCount).toBeNull();
  });

  it('throws ProjectNotFoundError for an unknown id', async () => {
    await expect(
      readProject('chatframe_2026-06-10_does-not-exist', { projectsDir }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('throws ManifestValidationError when the manifest is corrupted', async () => {
    const created = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });
    const root = join(projectsDir, created.projectId);

    // Manually corrupt the manifest (e.g. a hand edit broke the status enum).
    await writeFile(
      manifestPath(root),
      JSON.stringify({ displayName: 'x', status: 'bogus' }),
      'utf8',
    );

    await expect(readProject(created.projectId, { projectsDir })).rejects.toBeInstanceOf(
      ManifestValidationError,
    );
  });
});

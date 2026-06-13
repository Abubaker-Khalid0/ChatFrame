import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ProjectManifestSchema,
  SourceMetadataSchema,
  type CreateProjectRequest,
} from '@chatframe/shared';
import { readJson } from '../storage/JsonFile';
import { createProject } from './ProjectStore';
import { manifestPath, sourcePath } from './ProjectManifest';

const baseRequest: CreateProjectRequest = {
  chatId: '201234567890@c.us',
  chatDisplayName: 'أحمد',
  chatPhoneNumber: '+201234567890',
  adapter: 'whatsapp-web.js',
  adapterVersion: '1.0.0',
};

const FIXED_NOW = new Date('2026-06-10T09:30:00.000Z');

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

let projectsDir: string;

beforeEach(async () => {
  projectsDir = await mkdtemp(join(tmpdir(), 'chatframe-store-'));
});

afterEach(async () => {
  await rm(projectsDir, { recursive: true, force: true });
});

describe('createProject (FR-001, FR-002, SC-001)', () => {
  it('creates the full subdirectory structure on disk', async () => {
    const { projectId } = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });
    const root = join(projectsDir, projectId);

    for (const sub of [
      'raw',
      'normalized',
      join('media', 'images'),
      join('exports', 'html', 'assets'),
      'logs',
    ]) {
      expect(await exists(join(root, sub))).toBe(true);
    }
  });

  it('uses a deterministic Arabic folder name and preserves Unicode', async () => {
    const { projectId } = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });
    expect(projectId).toBe('chatframe_2026-06-10_أحمد');
  });

  it('writes a schema-valid manifest and immutable source metadata', async () => {
    const { projectId } = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });
    const root = join(projectsDir, projectId);

    const manifest = await readJson(manifestPath(root), ProjectManifestSchema);
    expect(manifest.status).toBe('created');
    expect(manifest.chatDisplayName).toBe('أحمد');
    expect(manifest.messageCount).toBeNull();

    const source = await readJson(sourcePath(root), SourceMetadataSchema);
    expect(source.adapter).toBe('whatsapp-web.js');
    expect(source.adapterVersion).toBe('1.0.0');
  });

  it('appends -2 when a folder name already exists', async () => {
    const first = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });
    const second = await createProject(baseRequest, { projectsDir, now: FIXED_NOW });

    expect(first.projectId).toBe('chatframe_2026-06-10_أحمد');
    expect(second.projectId).toBe('chatframe_2026-06-10_أحمد-2');
  });

  it('defaults adapterVersion to null when omitted', async () => {
    const request: CreateProjectRequest = {
      chatId: '201234567890@c.us',
      chatDisplayName: null,
      chatPhoneNumber: '+201234567890',
      adapter: 'whatsapp-web.js',
    };
    const { projectId } = await createProject(request, { projectsDir, now: FIXED_NOW });
    const source = await readJson(sourcePath(join(projectsDir, projectId)), SourceMetadataSchema);
    expect(source.adapterVersion).toBeNull();
  });
});

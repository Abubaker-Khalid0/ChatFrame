import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectManifestSchema, type ProjectManifest } from '@chatframe/shared';
import { readJson, writeJson } from './JsonFile';

const sampleManifest: ProjectManifest = {
  displayName: 'Chat with أحمد',
  createdAt: '2026-06-10T09:30:00.000Z',
  chatId: '201234567890@c.us',
  chatDisplayName: 'أحمد',
  chatPhoneNumber: '+201234567890',
  importedAt: null,
  messageCount: null,
  imageCount: null,
  status: 'created',
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-jsonfile-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('JsonFile (FR-010)', () => {
  it('writes pretty-printed JSON with a trailing newline', async () => {
    const path = join(dir, 'project.json');
    await writeJson(path, ProjectManifestSchema, sampleManifest);

    const raw = await readFile(path, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  "displayName"'); // 2-space indentation
  });

  it('reads back the written data as a typed object', async () => {
    const path = join(dir, 'project.json');
    await writeJson(path, ProjectManifestSchema, sampleManifest);

    const result = await readJson(path, ProjectManifestSchema);
    expect(result).toEqual(sampleManifest);
  });

  it('creates missing parent directories on write', async () => {
    const path = join(dir, 'nested', 'deep', 'project.json');
    await writeJson(path, ProjectManifestSchema, sampleManifest);

    const result = await readJson(path, ProjectManifestSchema);
    expect(result.displayName).toBe('Chat with أحمد');
  });
});

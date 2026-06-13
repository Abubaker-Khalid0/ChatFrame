import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectManifestSchema } from '@chatframe/shared';
import { ManifestValidationError } from '../utils/errors';
import { readJson } from './JsonFile';

/** Absolute path to the shared T007 manifest fixture. */
const FIXTURE_PATH = fileURLToPath(
  new URL('../projects/__fixtures__/mock-project-manifest.json', import.meta.url),
);

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-json-validation-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('JsonFile validation on read (FR-010, SC-003)', () => {
  it('reads the valid fixture manifest as typed data', async () => {
    const manifest = await readJson(FIXTURE_PATH, ProjectManifestSchema);
    expect(manifest.status).toBe('created');
    expect(manifest.chatDisplayName).toBe('أحمد');
    expect(manifest.messageCount).toBeNull();
  });

  it('rejects a manifest with a missing required field, citing the field', async () => {
    const { displayName: _omitted, ...withoutDisplayName } = {
      displayName: 'x',
      createdAt: '2026-06-10T09:30:00.000Z',
      chatId: '201234567890@c.us',
      chatDisplayName: 'أحمد',
      chatPhoneNumber: '+201234567890',
      importedAt: null,
      messageCount: null,
      imageCount: null,
      status: 'created',
    };
    const path = join(dir, 'project.json');
    await writeFile(path, JSON.stringify(withoutDisplayName), 'utf8');

    await expect(readJson(path, ProjectManifestSchema)).rejects.toBeInstanceOf(
      ManifestValidationError,
    );

    try {
      await readJson(path, ProjectManifestSchema);
      expect.unreachable('expected a ManifestValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestValidationError);
      const details = (error as ManifestValidationError).details;
      expect(details.some((issue) => issue.path === 'displayName')).toBe(true);
      expect(details[0]?.message).toBeTruthy();
    }
  });

  it('rejects a manifest with an invalid status enum, citing `status`', async () => {
    const invalid = {
      displayName: 'Chat with أحمد',
      createdAt: '2026-06-10T09:30:00.000Z',
      chatId: '201234567890@c.us',
      chatDisplayName: 'أحمد',
      chatPhoneNumber: '+201234567890',
      importedAt: null,
      messageCount: null,
      imageCount: null,
      status: 'not-a-real-status',
    };
    const path = join(dir, 'project.json');
    await writeFile(path, JSON.stringify(invalid), 'utf8');

    try {
      await readJson(path, ProjectManifestSchema);
      expect.unreachable('expected a ManifestValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestValidationError);
      const details = (error as ManifestValidationError).details;
      expect(details.some((issue) => issue.path === 'status')).toBe(true);
    }
  });

  it('rejects a file whose contents are not valid JSON', async () => {
    const path = join(dir, 'project.json');
    await writeFile(path, '{ this is not json', 'utf8');

    await expect(readJson(path, ProjectManifestSchema)).rejects.toBeInstanceOf(
      ManifestValidationError,
    );
  });
});

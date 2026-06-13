import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizedDir } from '../projects/ProjectPaths';
import { cleanupStaging, createStagingDir, promoteStaging } from './atomicStaging';

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'chatframe-staging-'));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe('atomicStaging (FR-021)', () => {
  it('promotes staged files into normalized/ and removes the staging dir', async () => {
    const staging = await createStagingDir(projectDir, 'run-1');
    await writeFile(join(staging, 'messages.ndjson'), '{"id":"m1"}\n', 'utf8');
    await writeFile(join(staging, 'quality-report.json'), '{}\n', 'utf8');

    await promoteStaging(projectDir, staging);

    const out = await readdir(normalizedDir(projectDir));
    expect(out.sort()).toEqual(['messages.ndjson', 'quality-report.json']);
    expect(existsSync(staging)).toBe(false);
    expect(await readFile(join(normalizedDir(projectDir), 'messages.ndjson'), 'utf8')).toBe(
      '{"id":"m1"}\n',
    );
  });

  it('overwrites an existing normalized output on promote', async () => {
    await mkdir(normalizedDir(projectDir), { recursive: true });
    await writeFile(join(normalizedDir(projectDir), 'messages.ndjson'), 'OLD', 'utf8');

    const staging = await createStagingDir(projectDir, 'run-2');
    await writeFile(join(staging, 'messages.ndjson'), 'NEW', 'utf8');
    await promoteStaging(projectDir, staging);

    expect(await readFile(join(normalizedDir(projectDir), 'messages.ndjson'), 'utf8')).toBe('NEW');
  });

  it('preserves pre-existing normalized files not produced by the run', async () => {
    await mkdir(normalizedDir(projectDir), { recursive: true });
    await writeFile(join(normalizedDir(projectDir), 'media.json'), '[]', 'utf8');

    const staging = await createStagingDir(projectDir, 'run-3');
    await writeFile(join(staging, 'messages.ndjson'), 'x', 'utf8');
    await promoteStaging(projectDir, staging);

    const out = await readdir(normalizedDir(projectDir));
    expect(out.sort()).toEqual(['media.json', 'messages.ndjson']);
  });

  it('leaves normalized/ untouched and removes staging on a simulated failure', async () => {
    // normalized/ already holds a previously-promoted output.
    await mkdir(normalizedDir(projectDir), { recursive: true });
    await writeFile(join(normalizedDir(projectDir), 'messages.ndjson'), 'PREVIOUS', 'utf8');

    // A run stages a partial output, then "fails" before promotion.
    const staging = await createStagingDir(projectDir, 'run-4');
    await writeFile(join(staging, 'messages.ndjson'), 'PARTIAL', 'utf8');
    await cleanupStaging(staging);

    expect(existsSync(staging)).toBe(false);
    const out = await readdir(normalizedDir(projectDir));
    expect(out).toEqual(['messages.ndjson']);
    expect(await readFile(join(normalizedDir(projectDir), 'messages.ndjson'), 'utf8')).toBe(
      'PREVIOUS',
    );
  });

  it('cleanup tolerates a missing staging directory', async () => {
    await expect(
      cleanupStaging(join(projectDir, 'normalized.tmp-missing')),
    ).resolves.toBeUndefined();
  });
});

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runNormalizationPipeline } from './NormalizationPipeline';
import { rawMessagesPath } from '../projects/ProjectPaths';

const FIXTURE = fileURLToPath(
  new URL('./__fixtures__/raw-messages.sample.ndjson', import.meta.url),
);
const FIXED_NOW = (): Date => new Date('2026-06-10T12:00:00.000Z');

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'chatframe-determinism-'));
  await mkdir(join(projectDir, 'raw'), { recursive: true });
  await writeFile(rawMessagesPath(projectDir), await readFile(FIXTURE, 'utf8'), 'utf8');
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

const DETERMINISTIC_OUTPUTS = [
  'messages.ndjson',
  'participants.json',
  'render-model.json',
] as const;

async function readOutputs(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const name of DETERMINISTIC_OUTPUTS) {
    result[name] = await readFile(join(projectDir, 'normalized', name), 'utf8');
  }
  return result;
}

describe('normalization determinism (FR-014, SC-003)', () => {
  it('produces byte-identical outputs across two runs (excluding the report timestamp)', async () => {
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const first = await readOutputs();

    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const second = await readOutputs();

    for (const name of DETERMINISTIC_OUTPUTS) {
      expect(second[name]).toBe(first[name]);
    }
  });

  it('re-running regenerates outputs from raw and leaves no staging directory (FR-020, FR-021)', async () => {
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });

    const entries = await readdir(projectDir);
    expect(entries.some((name) => name.startsWith('normalized.tmp-'))).toBe(false);

    // All derived outputs are present after the re-run.
    const normalized = await readdir(join(projectDir, 'normalized'));
    expect(normalized.sort()).toEqual([
      'messages.ndjson',
      'participants.json',
      'quality-report.json',
      'render-model.json',
    ]);
  });
});

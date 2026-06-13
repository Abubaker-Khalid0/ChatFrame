import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NormalizedMessageSchema, type RawWhatsAppMessage } from '@chatframe/shared';
import { rawMessagesPath, normalizedMessagesPath } from '../projects/ProjectPaths';
import { runNormalizationPipeline } from './NormalizationPipeline';

/**
 * 010 T058 — normalization edge case hardening tests. The full pipeline is
 * exercised against: extremely long messages (10,000+ chars), corrupted
 * NDJSON lines, empty conversations, records with unexpected structures, and
 * duplicated raw records (re-imported data). Nothing may be silently dropped
 * (Constitution XXIII) and the pipeline must stay deterministic.
 */

const PROJECT_ID = 'edge-case-project';

let projectDir: string;

function rawMessage(overrides: Partial<RawWhatsAppMessage> & { id: string }): RawWhatsAppMessage {
  return {
    chatId: 'edge@c.us',
    fromMe: false,
    author: 'edge-contact@c.us',
    timestamp: 1_750_000_000,
    type: 'chat',
    body: 'hello',
    hasMedia: false,
    ...overrides,
  };
}

async function writeRaw(lines: string[]): Promise<void> {
  const path = rawMessagesPath(projectDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, lines.join('\n') + '\n', 'utf8');
}

async function readNormalized(): Promise<unknown[]> {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(normalizedMessagesPath(projectDir), 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), 'chatframe-edge-'));
  projectDir = join(root, PROJECT_ID);
});

afterEach(async () => {
  await rm(dirname(projectDir), { recursive: true, force: true });
});

describe('normalization edge cases (010 T058)', () => {
  it('preserves an extremely long message (10,000+ chars) end to end', async () => {
    const longBody = 'م'.repeat(6_000) + 'x'.repeat(6_000);
    await writeRaw([
      JSON.stringify(rawMessage({ id: 'long-1', body: longBody })),
      JSON.stringify(rawMessage({ id: 'after-1', timestamp: 1_750_000_100 })),
    ]);

    const metrics = await runNormalizationPipeline({ projectDir, projectId: PROJECT_ID });
    expect(metrics.totalNormalizedMessages).toBe(2);

    const normalized = await readNormalized();
    const long = normalized
      .map((record) => NormalizedMessageSchema.parse(record))
      .find((message) => message.id === 'long-1');
    expect(long?.body).toHaveLength(12_000);
    expect(long?.body).toBe(longBody);
  });

  it('records corrupted NDJSON lines as warnings without dropping valid ones', async () => {
    await writeRaw([
      JSON.stringify(rawMessage({ id: 'ok-1' })),
      '{not valid json at all',
      JSON.stringify({ id: 'bad-shape', unexpected: true }),
      JSON.stringify(rawMessage({ id: 'ok-2', timestamp: 1_750_000_200 })),
    ]);

    const metrics = await runNormalizationPipeline({ projectDir, projectId: PROJECT_ID });

    expect(metrics.totalRawMessages).toBe(4);
    expect(metrics.totalNormalizedMessages).toBe(2);
    // Every rejected line surfaces as a warning — never a silent drop.
    expect(metrics.warnings.length).toBeGreaterThanOrEqual(2);
    const normalized = await readNormalized();
    expect(normalized).toHaveLength(2);
  });

  it('fails an empty conversation with the fatal NO_MESSAGES report (FR-018)', async () => {
    await writeRaw([]);

    await expect(runNormalizationPipeline({ projectDir, projectId: PROJECT_ID })).rejects.toThrow(
      /fatal data error/i,
    );
  });

  it('tolerates unexpected structures (wrong types, nulls, extra fields)', async () => {
    await writeRaw([
      JSON.stringify({ ...rawMessage({ id: 'weird-1' }), body: 12345 }),
      JSON.stringify({ ...rawMessage({ id: 'weird-2' }), timestamp: 'yesterday' }),
      JSON.stringify({ ...rawMessage({ id: 'weird-3' }), extraField: { deep: [1, 2, 3] } }),
      'null',
      JSON.stringify(rawMessage({ id: 'ok-1', timestamp: 1_750_000_300 })),
    ]);

    const metrics = await runNormalizationPipeline({ projectDir, projectId: PROJECT_ID });

    // weird-3 passes (unknown extra fields are not an error); weird-1/-2/null
    // are rejected with warnings; ok-1 always survives.
    expect(metrics.totalNormalizedMessages).toBe(2);
    expect(metrics.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('deduplicates a re-imported (duplicated) conversation deterministically', async () => {
    const original = [
      rawMessage({ id: 'dup-1', timestamp: 1_750_000_000 }),
      rawMessage({ id: 'dup-2', timestamp: 1_750_000_060, body: 'second' }),
    ];
    // The same records appear twice, as after an interrupted + retried fetch.
    await writeRaw([...original, ...original].map((message) => JSON.stringify(message)));

    const metrics = await runNormalizationPipeline({ projectDir, projectId: PROJECT_ID });

    expect(metrics.totalRawMessages).toBe(4);
    expect(metrics.duplicatesRemoved).toBe(2);
    expect(metrics.totalNormalizedMessages).toBe(2);

    const ids = (await readNormalized()).map((record) => NormalizedMessageSchema.parse(record).id);
    expect(ids).toEqual(['dup-1', 'dup-2']);
  });
});

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  NormalizedMessageSchema,
  ParticipantListSchema,
  QualityReportSchema,
  RenderModelSchema,
} from '@chatframe/shared';
import { runNormalizationPipeline } from './NormalizationPipeline';
import { normalizedMessagesPath, rawMessagesPath } from '../projects/ProjectPaths';

const FIXTURE = fileURLToPath(
  new URL('./__fixtures__/raw-messages.sample.ndjson', import.meta.url),
);
const FIXED_NOW = (): Date => new Date('2026-06-10T12:00:00.000Z');

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'chatframe-pipeline-'));
  await mkdir(join(projectDir, 'raw'), { recursive: true });
  const fixture = await readFile(FIXTURE, 'utf8');
  await writeFile(rawMessagesPath(projectDir), fixture, 'utf8');
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function readOutputLines(): Promise<string[]> {
  const raw = await readFile(normalizedMessagesPath(projectDir), 'utf8');
  return raw.split('\n').filter((line) => line.trim().length > 0);
}

describe('NormalizationPipeline US1 (SC-002, FR-021)', () => {
  it('produces sorted, schema-valid normalized messages', async () => {
    const metrics = await runNormalizationPipeline({
      projectDir,
      projectId: 'p1',
      now: FIXED_NOW,
    });

    const lines = await readOutputLines();
    expect(lines).toHaveLength(10);

    const messages = lines.map((line) => NormalizedMessageSchema.parse(JSON.parse(line)));
    // Sorted ascending by timestampIso.
    const isoList = messages.map((m) => m.timestampIso);
    expect([...isoList].sort()).toEqual(isoList);

    expect(metrics.totalNormalizedMessages).toBe(10);
    expect(metrics.dateFrom).toBe(isoList[0]);
    expect(metrics.dateTo).toBe(isoList[isoList.length - 1]);
  });

  it('records zero silent data loss against the raw line count', async () => {
    const metrics = await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });

    const invalidWarnings = metrics.warnings.filter((w) => w.code === 'INVALID_RAW_MESSAGE').length;
    // Every raw line is normalized, removed as a duplicate, or recorded as an
    // invalid warning — nothing is silently dropped.
    expect(metrics.totalNormalizedMessages + metrics.duplicatesRemoved + invalidWarnings).toBe(
      metrics.totalRawMessages,
    );
    expect(metrics.totalRawMessages).toBe(13);
    expect(metrics.duplicatesRemoved).toBe(1);
    expect(invalidWarnings).toBe(2);
  });

  it('preserves unsupported types and tallies them', async () => {
    const metrics = await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    expect(metrics.unsupportedMessageTypes).toEqual({ audio: 1, sticker: 1 });
  });

  it('links image messages as missing when no media has been downloaded', async () => {
    const metrics = await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const messages = (await readOutputLines()).map((line) =>
      NormalizedMessageSchema.parse(JSON.parse(line)),
    );

    const image = messages.find((m) => m.id === 'm3');
    expect(image?.type).toBe('image');
    expect(image?.image?.missing).toBe(true);
    expect(image?.image?.mediaId).toBe('img-1');
    // The fixture references one image and no media.json exists in the project.
    expect(metrics.missingImages).toBe(1);
  });

  it('resolves reply references against the normalized set', async () => {
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const messages = (await readOutputLines()).map((line) =>
      NormalizedMessageSchema.parse(JSON.parse(line)),
    );

    const reply = messages.find((m) => m.id === 'm7');
    expect(reply?.replyTo?.resolved).toBe(true);
    expect(reply?.replyTo?.messageId).toBe('m1');
    expect(reply?.replyTo?.previewType).toBe('text');
    expect(reply?.replyTo?.previewText).toBe('السلام عليكم! كيف حالك؟');
  });

  it('emits missing- and future-timestamp warnings', async () => {
    const metrics = await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const codes = metrics.warnings.map((w) => w.code);
    expect(codes).toContain('MISSING_TIMESTAMP');
    expect(codes).toContain('FUTURE_TIMESTAMP');
  });

  it('leaves no staging directory after a successful run', async () => {
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const entries = await readdir(projectDir);
    expect(entries.some((name) => name.startsWith('normalized.tmp-'))).toBe(false);
    expect(entries).toContain('normalized');
  });

  it('writes a structural normalization log', async () => {
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const log = await readFile(join(projectDir, 'logs', 'normalization.log'), 'utf8');
    expect(log).toMatch(/readRaw/);
    expect(log).toMatch(/sortMessages/);
    // No message content leaks into the log.
    expect(log).not.toMatch(/السلام|Sunset|Edited message/);
  });

  it('writes a schema-valid render model with date separators', async () => {
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const model = RenderModelSchema.parse(
      JSON.parse(await readFile(join(projectDir, 'normalized', 'render-model.json'), 'utf8')),
    );

    expect(model.projectId).toBe('p1');
    expect(model.totalMessages).toBe(10);
    const messageEntries = model.entries.filter((e) => e.kind === 'message');
    expect(messageEntries).toHaveLength(10);
    // The first entry is a date separator preceding the earliest message.
    expect(model.entries[0]?.kind).toBe('date-separator');
    // Participants are resolved (US6) and embedded in the render model.
    expect(model.participants.map((p) => p.id).sort()).toEqual(['contact-1', 'me']);
  });

  it('writes a schema-valid participants.json with the resolved senders', async () => {
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const participants = ParticipantListSchema.parse(
      JSON.parse(await readFile(join(projectDir, 'normalized', 'participants.json'), 'utf8')),
    );

    expect(participants).toHaveLength(2);
    expect(participants.map((p) => p.id).sort()).toEqual(['contact-1', 'me']);
    expect(participants.find((p) => p.id === 'me')?.isMe).toBe(true);
    expect(participants.find((p) => p.id === 'contact-1')?.isMe).toBe(false);
  });

  it('writes a schema-valid quality report reflecting the run', async () => {
    await runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW });
    const report = QualityReportSchema.parse(
      JSON.parse(await readFile(join(projectDir, 'normalized', 'quality-report.json'), 'utf8')),
    );

    expect(report.projectId).toBe('p1');
    expect(report.totalRawMessages).toBe(13);
    expect(report.totalNormalizedMessages).toBe(10);
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.missingImages).toBe(1);
    expect(report.unsupportedMessageTypes).toEqual({ audio: 1, sticker: 1 });
    expect(report.dateRange.from).not.toBeNull();
    expect(report.errors).toEqual([]);
    expect(report.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['INVALID_RAW_MESSAGE', 'MISSING_TIMESTAMP', 'FUTURE_TIMESTAMP']),
    );
  });

  it('fails the run on a fatal error but still promotes the quality report', async () => {
    await writeFile(rawMessagesPath(projectDir), 'not-json\n', 'utf8');

    await expect(
      runNormalizationPipeline({ projectDir, projectId: 'p1', now: FIXED_NOW }),
    ).rejects.toThrow(/fatal/i);

    const report = QualityReportSchema.parse(
      JSON.parse(await readFile(join(projectDir, 'normalized', 'quality-report.json'), 'utf8')),
    );
    expect(report.totalNormalizedMessages).toBe(0);
    expect(report.errors.some((e) => e.fatal)).toBe(true);
  });
});

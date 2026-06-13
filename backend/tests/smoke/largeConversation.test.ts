import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RenderModelSchema, type RenderModel } from '@chatframe/shared';
import {
  DEFAULT_SMOKE_CONFIG,
  generateLargeFixture,
  serializeFixtureToNdjson,
} from '../../src/normalization/__fixtures__/generateLargeFixture';
import { runNormalizationPipeline } from '../../src/normalization/NormalizationPipeline';
import { exportHtml } from '../../src/export/HtmlExporter';
import { rawMessagesPath, renderModelPath } from '../../src/projects/ProjectPaths';
import { readJson } from '../../src/storage/JsonFile';

/**
 * 010 US5 / T043 — large conversation smoke test (contracts §9).
 *
 * Runs the full pipeline at scale: a deterministic 5,000+ message fixture is
 * written as raw NDJSON, normalized (read → map → classify → sort → dedup →
 * replies → images → render model → quality report), and exported to the
 * offline HTML archive. Each step must complete within the thresholds from
 * data-model §3.2 (CI-friendly: thresholds are upper bounds, not targets).
 */

const PROJECT_ID = 'smoke-large-conversation';

/** Thresholds (ms) per data-model §3.2. */
const NORMALIZATION_THRESHOLD_MS = 10_000;
const EXPORT_THRESHOLD_MS = 15_000;

let projectDir: string;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'chatframe-smoke-'));
  projectDir = join(root, PROJECT_ID);
  const rawPath = rawMessagesPath(projectDir);
  await mkdir(dirname(rawPath), { recursive: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(rawPath, serializeFixtureToNdjson(generateLargeFixture()), 'utf8');
});

afterAll(async () => {
  await rm(dirname(projectDir), { recursive: true, force: true });
});

describe('large conversation pipeline smoke (5,000+ messages)', () => {
  let normalizationMs = 0;
  let model: RenderModel;

  it('normalizes 5,000 messages within the threshold', async () => {
    const start = Date.now();
    const metrics = await runNormalizationPipeline({ projectDir, projectId: PROJECT_ID });
    normalizationMs = Date.now() - start;

    expect(metrics.totalRawMessages).toBe(DEFAULT_SMOKE_CONFIG.messageCount);
    expect(metrics.totalNormalizedMessages).toBe(DEFAULT_SMOKE_CONFIG.messageCount);
    // All fixture images reference media that was never downloaded — every
    // one must surface as a visible placeholder, never silently dropped.
    expect(metrics.missingImages).toBe(DEFAULT_SMOKE_CONFIG.imageCount);
    const unsupportedTotal = Object.values(metrics.unsupportedMessageTypes).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(unsupportedTotal).toBe(DEFAULT_SMOKE_CONFIG.unsupportedCount);

    expect(normalizationMs).toBeLessThan(NORMALIZATION_THRESHOLD_MS);
  }, 60_000);

  it('produces a complete render model (no message lost at scale)', async () => {
    model = await readJson(renderModelPath(projectDir), RenderModelSchema);
    expect(model.totalMessages).toBe(DEFAULT_SMOKE_CONFIG.messageCount);
    // The fixture spans the configured number of distinct days — one date
    // separator entry leads each day.
    const separators = model.entries.filter((entry) => entry.kind === 'date-separator');
    expect(separators.length).toBeGreaterThanOrEqual(DEFAULT_SMOKE_CONFIG.dateBoundaries);
  }, 30_000);

  it('exports the offline HTML archive within the threshold', async () => {
    const start = Date.now();
    const result = await exportHtml({
      projectId: PROJECT_ID,
      projectDir,
      settings: {
        showContactName: true,
        showPhoneNumber: false,
        showWatermark: true,
        theme: 'light',
      },
      locale: 'en',
    });
    const exportMs = Date.now() - start;

    // ExportResult paths are project-relative (009 contracts).
    const htmlAbsolute = join(projectDir, result.htmlFilePath);
    const html = await readFile(htmlAbsolute, 'utf8');
    expect(html.length).toBeGreaterThan(100_000);
    expect((await stat(htmlAbsolute)).size).toBeGreaterThan(0);

    expect(exportMs).toBeLessThan(EXPORT_THRESHOLD_MS);
  }, 60_000);
});

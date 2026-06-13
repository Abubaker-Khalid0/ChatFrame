import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ImportProgressSchema,
  QualityReportSchema,
  type ImportProgress,
  type RawWhatsAppMessage,
  type SseImportErrorEvent,
} from '@chatframe/shared';
import { runNormalizationPipeline } from '../normalization/NormalizationPipeline';
import { readManifest } from '../projects/ProjectManifest';
import { projectDirPath } from '../projects/ProjectPaths';
import { readJson } from '../storage/JsonFile';
import { MockAdapter } from '../whatsapp/MockAdapter';
import { MOCK_FATAL_CHAT_ID } from '../whatsapp/fixtures/mock-import-messages';
import { startImport, type StartImportOptions } from './ImportOrchestrator';
import { requestCancel, resetImportRegistry } from './importRegistry';

const CHAT_ID = '905551234567@c.us';

let projectsDir: string;
let events: Array<{ name: string; data: unknown }>;

const eventSink = {
  broadcast: (name: string, data: unknown): void => {
    events.push({ name, data: JSON.parse(JSON.stringify(data)) as unknown });
  },
};

beforeEach(async () => {
  projectsDir = await mkdtemp(join(tmpdir(), 'chatframe-orchestrator-'));
  events = [];
  resetImportRegistry();
});

afterEach(async () => {
  await rm(projectsDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function baseOptions(overrides: Partial<StartImportOptions> = {}): StartImportOptions {
  return {
    request: {
      chatId: CHAT_ID,
      chatDisplayName: 'Layla',
      options: { includeImages: false },
    },
    adapter: new MockAdapter(),
    projectsDir,
    events: eventSink,
    adapterName: 'mock',
    retryDelaysMs: [0, 0, 0],
    sleep: () => Promise.resolve(),
    ...overrides,
  };
}

function progressEvents(name: string): ImportProgress[] {
  return events
    .filter((event) => event.name === name)
    .map((event) => ImportProgressSchema.parse(event.data));
}

function stagesSeen(): string[] {
  const stages: string[] = [];
  for (const event of progressEvents('import.progress')) {
    if (stages[stages.length - 1] !== event.stage) {
      stages.push(event.stage);
    }
  }
  return stages;
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

describe('ImportOrchestrator — US1 text-only import (FR-001, FR-008, SC-001, SC-007)', () => {
  it('runs end-to-end: folder, raw NDJSON, normalization, quality report, completed', async () => {
    const handle = await startImport(baseOptions());
    const terminal = await handle.done;

    expect(terminal.stage).toBe('completed');
    expect(terminal.completedAt).toBeDefined();
    // The fixture stream has 12 raw entries (one duplicated id).
    expect(terminal.messagesImported).toBe(12);
    expect(terminal.messagesTotal).toBe(12);
    // Text-only: the image stage is skipped and no image is downloaded.
    expect(terminal.imagesDownloaded).toBe(0);

    const projectDir = projectDirPath(handle.projectId, projectsDir);
    // Project scaffolding + manifests (FR-030).
    expect((await stat(join(projectDir, 'project.json'))).isFile()).toBe(true);
    expect((await stat(join(projectDir, 'source.json'))).isFile()).toBe(true);

    // Raw NDJSON: one line per fetched message (FR-004, FR-005).
    const rawPath = join(projectDir, 'raw', 'messages.raw.ndjson');
    const rawLines = (await readFile(rawPath, 'utf8')).trim().split('\n');
    expect(rawLines).toHaveLength(12);

    // Normalized outputs + quality report (FR-008, FR-010).
    expect((await stat(join(projectDir, 'normalized', 'messages.ndjson'))).isFile()).toBe(true);
    const report = await readJson(
      join(projectDir, 'normalized', 'quality-report.json'),
      QualityReportSchema,
    );
    expect(report.totalRawMessages).toBe(12);
    expect(report.duplicatesRemoved).toBe(1);

    // Stage progression: monotonic, starting at preparing_project,
    // skipping downloading_images, ending completed (US2 AC-5).
    const stages = stagesSeen();
    expect(stages[0]).toBe('preparing_project');
    expect(stages).not.toContain('downloading_images');
    expect(stages).toContain('fetching_messages');
    expect(stages).toContain('normalizing');
    expect(stages).toContain('resolving_replies');
    expect(stages).toContain('generating_quality_report');
    expect(stages).toContain('preparing_preview');
    expect(stages[stages.length - 1]).toBe('completed');

    // Terminal event carries the final snapshot (FR-016).
    const completedEvents = progressEvents('import.completed');
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0]?.stage).toBe('completed');

    // project.json records the durable outcome (data-model §9).
    const manifest = await readManifest(projectDir);
    expect(manifest.status).toBe('imported');
    expect(manifest.messageCount).toBe(12);
    expect(manifest.importedAt).not.toBeNull();

    // Raw immutability: a re-normalize never rewrites the raw file (SC-007).
    const hashBefore = await sha256(rawPath);
    await runNormalizationPipeline({ projectDir, projectId: handle.projectId });
    expect(await sha256(rawPath)).toBe(hashBefore);

    // The import log exists and carries no message content, sender names, or
    // session secrets — ids/counts/timing only (FR-026, SC-010).
    const log = await readFile(join(projectDir, 'logs', 'import.log'), 'utf8');
    expect(log.length).toBeGreaterThan(0);
    expect(log).not.toContain('السلام'); // fixture body text
    expect(log).not.toContain('صورة'); // fixture caption text
    expect(log).not.toContain('Layla'); // chat/sender display name
    expect(log).not.toMatch(/qr/i);
    expect(log).not.toMatch(/token/i);
    expect(log).not.toMatch(/secret/i);
    expect(log).not.toMatch(/session/i);
  });
});

describe('ImportOrchestrator — US2 image import (SC-002, SC-005, SC-006)', () => {
  it('saves images, records provenance, links them, and reports missing ones', async () => {
    const handle = await startImport(
      baseOptions({
        request: { chatId: CHAT_ID, chatDisplayName: 'Layla', options: { includeImages: true } },
      }),
    );
    const terminal = await handle.done;

    // Forced failures never crash the import (SC-005).
    expect(terminal.stage).toBe('completed');
    // 3 downloadable media entries; media-fail-001 exhausts retries.
    expect(terminal.imagesTotal).toBe(3);
    expect(terminal.imagesDownloaded).toBe(2);
    expect(terminal.warnings.some((w) => w.includes('missing'))).toBe(true);

    const projectDir = projectDirPath(handle.projectId, projectsDir);

    // Saved image files (SC-002).
    const imageFiles = await readdir(join(projectDir, 'media', 'images'));
    expect(imageFiles.filter((f) => f.startsWith('img_'))).toHaveLength(2);

    // Raw media provenance: one line per media id, one missing (FR-007).
    const mediaRaw = (await readFile(join(projectDir, 'raw', 'media.raw.ndjson'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { mediaId: string; missing: boolean });
    expect(mediaRaw).toHaveLength(3);
    expect(mediaRaw.filter((r) => r.missing)).toHaveLength(1);

    // Normalized output links image fields (FR-009/FR-011 of phase 4).
    const normalized = (await readFile(join(projectDir, 'normalized', 'messages.ndjson'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string; image?: { missing: boolean } });
    const imageMessages = normalized.filter((m) => m.type === 'image');
    expect(imageMessages.length).toBeGreaterThanOrEqual(3);
    expect(imageMessages.some((m) => m.image?.missing === false)).toBe(true);

    // Missing images are counted, not dropped (SC-006, Constitution XXIII).
    const report = await readJson(
      join(projectDir, 'normalized', 'quality-report.json'),
      QualityReportSchema,
    );
    expect(report.missingImages).toBeGreaterThanOrEqual(1);

    // A warning event was emitted for the failed download (FR-012, FR-016).
    const warningEvents = events.filter((e) => e.name === 'import.warning');
    expect(
      warningEvents.some((e) => (e.data as { code: string }).code === 'IMAGE_DOWNLOAD_FAILED'),
    ).toBe(true);

    const stages = stagesSeen();
    expect(stages).toContain('downloading_images');
  });
});

describe('ImportOrchestrator — US3 progress cadence (FR-029, SC-003)', () => {
  it('emits a progress event on every stage transition', async () => {
    const handle = await startImport(baseOptions());
    await handle.done;

    const stages = stagesSeen();
    // Every visible stage of a text-only run appears exactly once, in order.
    expect(stages).toEqual([
      'preparing_project',
      'fetching_metadata',
      'fetching_messages',
      'saving_raw_messages',
      'normalizing',
      'resolving_replies',
      'generating_quality_report',
      'preparing_preview',
      'completed',
    ]);
  });

  it('emits throttled count updates at least every 50 items during fetch', async () => {
    const manyMessages = (chatId: string): RawWhatsAppMessage[] =>
      Array.from({ length: 120 }, (_, i) => ({
        id: `raw-${String(i).padStart(4, '0')}`,
        chatId,
        fromMe: i % 2 === 0,
        author: i % 2 === 0 ? 'me' : 'contact-001',
        timestamp: 1_780_000_000 + i * 60,
        type: 'chat',
        body: `m${i}`,
        hasMedia: false,
      }));

    const handle = await startImport(
      baseOptions({ adapter: new MockAdapter({ messages: manyMessages }) }),
    );
    await handle.done;

    const fetchCounts = progressEvents('import.progress')
      .filter((event) => event.stage === 'fetching_messages')
      .map((event) => event.messagesImported);
    // The clock is effectively frozen within the run, so the 50-item rule
    // produces updates at 50 and 100 in addition to the stage transition.
    expect(fetchCounts).toContain(50);
    expect(fetchCounts).toContain(100);
  });

  it('emits on the 2-second rule when item counts stay low (injected clock)', async () => {
    let nowMs = 1_780_000_000_000;
    const now = (): Date => {
      // Every clock read advances one second — guaranteeing the 2s rule
      // fires between per-message throttle checks (FR-029).
      nowMs += 1_000;
      return new Date(nowMs);
    };

    const handle = await startImport(baseOptions({ now, progressEveryItems: 1_000 }));
    await handle.done;

    const fetchEvents = progressEvents('import.progress').filter(
      (event) => event.stage === 'fetching_messages' && event.messagesImported > 0,
    );
    expect(fetchEvents.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ImportOrchestrator — US4 cancellation (SC-008)', () => {
  it('halts mid-fetch at a safe boundary, preserves raw data, and reports cancelled', async () => {
    const options = baseOptions({
      adapter: new MockAdapter({ messageDelayMs: 1 }),
      progressEveryItems: 1,
    });
    // Cancel as soon as two messages have been imported, via the same
    // broadcast channel the UI would observe.
    let cancelIssued = false;
    options.events = {
      broadcast: (name: string, data: unknown): void => {
        eventSink.broadcast(name, data);
        if (cancelIssued || name !== 'import.progress') return;
        const progress = ImportProgressSchema.parse(data);
        if (progress.stage === 'fetching_messages' && progress.messagesImported >= 2) {
          cancelIssued = true;
          requestCancel(progress.importId);
        }
      },
    };

    const handle = await startImport(options);
    const terminal = await handle.done;

    expect(terminal.stage).toBe('cancelled');
    expect(terminal.messagesImported).toBeGreaterThanOrEqual(2);
    expect(terminal.messagesImported).toBeLessThan(12);

    // Partial raw data is preserved (US4 AC-3).
    const projectDir = projectDirPath(handle.projectId, projectsDir);
    const rawLines = (await readFile(join(projectDir, 'raw', 'messages.raw.ndjson'), 'utf8'))
      .trim()
      .split('\n');
    expect(rawLines.length).toBe(terminal.messagesImported);

    // Terminal event + durable record (FR-016; data-model §9).
    const completedEvents = progressEvents('import.completed');
    expect(completedEvents[completedEvents.length - 1]?.stage).toBe('cancelled');
    expect((await readManifest(projectDir)).status).toBe('cancelled');

    // No normalization ran after the cancel boundary.
    await expect(stat(join(projectDir, 'normalized', 'messages.ndjson'))).rejects.toThrow();
  });

  it('halts during downloading_images and preserves everything written', async () => {
    const options = baseOptions({
      request: { chatId: CHAT_ID, options: { includeImages: true } },
      adapter: new MockAdapter({ imageDelayMs: 1 }),
      progressEveryItems: 1,
    });
    let cancelIssued = false;
    options.events = {
      broadcast: (name: string, data: unknown): void => {
        eventSink.broadcast(name, data);
        if (cancelIssued || name !== 'import.progress') return;
        const progress = ImportProgressSchema.parse(data);
        if (progress.stage === 'downloading_images') {
          cancelIssued = true;
          requestCancel(progress.importId);
        }
      },
    };

    const handle = await startImport(options);
    const terminal = await handle.done;

    expect(terminal.stage).toBe('cancelled');
    // The full message stream was already written before the image stage.
    const projectDir = projectDirPath(handle.projectId, projectsDir);
    const rawLines = (await readFile(join(projectDir, 'raw', 'messages.raw.ndjson'), 'utf8'))
      .trim()
      .split('\n');
    expect(rawLines).toHaveLength(12);
  });
});

describe('ImportOrchestrator — US5 fatal errors', () => {
  it('maps an adapter failure to a sanitized import.error and stage failed', async () => {
    const handle = await startImport(
      baseOptions({
        request: { chatId: MOCK_FATAL_CHAT_ID, options: { includeImages: false } },
      }),
    );
    const terminal = await handle.done;

    expect(terminal.stage).toBe('failed');
    expect(terminal.completedAt).toBeDefined();

    // import.error carries a code + user-safe message (US5 AC-3): no stack
    // traces and no raw library/internal error text.
    const errorEvents = events.filter((e) => e.name === 'import.error');
    expect(errorEvents).toHaveLength(1);
    const payload = errorEvents[0]?.data as SseImportErrorEvent;
    expect(payload.code).toBe('ADAPTER_ERROR');
    expect(payload.message).not.toContain('Mock adapter failure');
    expect(payload.message).not.toMatch(/\bat\s+\S+\.ts/);

    // Raw data written so far is preserved (US5 AC-2): file exists (empty).
    const projectDir = projectDirPath(handle.projectId, projectsDir);
    expect((await stat(join(projectDir, 'raw', 'messages.raw.ndjson'))).isFile()).toBe(true);

    // Terminal event + durable record.
    const completedEvents = progressEvents('import.completed');
    expect(completedEvents[completedEvents.length - 1]?.stage).toBe('failed');
    expect((await readManifest(projectDir)).status).toBe('error');
  });

  it('preserves the messages written before a mid-stream adapter failure (US5 AC-2)', async () => {
    const failingAdapter = new MockAdapter();
    const original = failingAdapter.fetchMessages.bind(failingAdapter);
    failingAdapter.fetchMessages = async function* (chatId, options) {
      let count = 0;
      for await (const message of original(chatId, options)) {
        yield message;
        count += 1;
        if (count >= 3) {
          throw new Error('connection dropped mid-stream');
        }
      }
    };

    const handle = await startImport(baseOptions({ adapter: failingAdapter }));
    const terminal = await handle.done;

    expect(terminal.stage).toBe('failed');
    // The three messages streamed before the failure are preserved.
    const projectDir = projectDirPath(handle.projectId, projectsDir);
    const rawLines = (await readFile(join(projectDir, 'raw', 'messages.raw.ndjson'), 'utf8'))
      .trim()
      .split('\n');
    expect(rawLines).toHaveLength(3);
  });
});

describe('ImportOrchestrator — edge cases', () => {
  it('completes immediately for an empty conversation with empty counts', async () => {
    const handle = await startImport(
      baseOptions({ adapter: new MockAdapter({ messages: () => [] }) }),
    );
    const terminal = await handle.done;

    expect(terminal.stage).toBe('completed');
    expect(terminal.messagesImported).toBe(0);
    expect(terminal.messagesTotal).toBeUndefined();
    expect(terminal.imagesDownloaded).toBe(0);
    expect(terminal.warnings).toEqual([]);

    const projectDir = projectDirPath(handle.projectId, projectsDir);
    expect(await readFile(join(projectDir, 'raw', 'messages.raw.ndjson'), 'utf8')).toBe('');
    expect((await readManifest(projectDir)).status).toBe('imported');
  });

  it('rejects a concurrent start while an import is active (FR-017)', async () => {
    const handle = await startImport(
      baseOptions({ adapter: new MockAdapter({ messageDelayMs: 2 }) }),
    );

    await expect(startImport(baseOptions())).rejects.toMatchObject({
      code: 'IMPORT_IN_PROGRESS',
    });

    await handle.done;
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ImportLogger } from './importLogger';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-import-log-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ImportLogger (FR-026, SC-010)', () => {
  it('appends structural stage and event entries with ids/counts/timing only', async () => {
    const logPath = join(dir, 'logs', 'import.log');
    const logger = new ImportLogger(logPath);

    logger.logStage({
      stage: 'fetching_messages',
      messagesImported: 50,
      imagesDownloaded: 0,
      warnings: 0,
      elapsedMs: 1234,
    });
    logger.logEvent({
      event: 'image_missing',
      code: 'IMAGE_DOWNLOAD_FAILED',
      messageId: 'raw-0091',
      mediaId: 'media-009',
    });

    const lines = (await readFile(logPath, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);

    const stage = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(stage).toMatchObject({
      msg: 'import_stage',
      stage: 'fetching_messages',
      messagesImported: 50,
      elapsedMs: 1234,
    });

    const event = JSON.parse(lines[1] ?? '{}') as Record<string, unknown>;
    expect(event).toMatchObject({
      msg: 'import_event',
      event: 'image_missing',
      messageId: 'raw-0091',
    });
  });

  it('never contains message bodies, sender names, or secrets (SC-010)', async () => {
    const logPath = join(dir, 'logs', 'import.log');
    const logger = new ImportLogger(logPath);

    // Simulate a full import's worth of logging using realistic ids/counts.
    for (const stage of ['preparing_project', 'fetching_messages', 'completed'] as const) {
      logger.logStage({
        stage,
        messagesImported: 1284,
        imagesDownloaded: 50,
        warnings: 2,
        elapsedMs: 192_000,
      });
    }
    logger.logEvent({ event: 'image_missing', code: 'IMAGE_DOWNLOAD_FAILED', mediaId: 'm-1' });
    logger.logEvent({ event: 'import_failed', code: 'ADAPTER_ERROR' });

    const contents = await readFile(logPath, 'utf8');

    // Fixture-style message content and sender names must never appear.
    expect(contents).not.toMatch(/السلام عليكم/);
    expect(contents).not.toMatch(/body/i);
    expect(contents).not.toMatch(/caption/i);
    expect(contents).not.toMatch(/sender/i);
    expect(contents).not.toMatch(/author/i);
    // Session secrets must never appear (Constitution XIII).
    expect(contents).not.toMatch(/qr/i);
    expect(contents).not.toMatch(/token/i);
    expect(contents).not.toMatch(/secret/i);
    expect(contents).not.toMatch(/session/i);
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NormalizationLogger } from './NormalizationLogger';

let dir: string;
let logPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-log-'));
  logPath = join(dir, 'logs', 'normalization.log');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('NormalizationLogger (FR-022, FR-023)', () => {
  it('writes one structural JSON line per step', async () => {
    const logger = new NormalizationLogger(logPath);
    logger.logStep({ step: 'readRaw', inputCount: 10, outputCount: 9, durationMs: 5, warnings: 1 });
    logger.logStep({
      step: 'sortMessages',
      inputCount: 9,
      outputCount: 9,
      durationMs: 2,
      warnings: 1,
    });

    const lines = (await readFile(logPath, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(first.step).toBe('readRaw');
    expect(first.inputCount).toBe(10);
    expect(first.outputCount).toBe(9);
    expect(first.durationMs).toBe(5);
    expect(first.warnings).toBe(1);
  });

  it('never writes message content, names, tokens, or QR data', async () => {
    const logger = new NormalizationLogger(logPath);
    logger.logStep({
      step: 'mapMessage',
      inputCount: 3,
      outputCount: 3,
      durationMs: 1,
      warnings: 0,
    });

    const contents = await readFile(logPath, 'utf8');
    // Sanity: the log must not contain anything resembling content fields.
    expect(contents).not.toMatch(/body|caption|senderDisplayName|token|qr/i);
    // It must also not leak pid/hostname (base disabled).
    expect(contents).not.toMatch(/hostname|"pid"/i);
  });
});

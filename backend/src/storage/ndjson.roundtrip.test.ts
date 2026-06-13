import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NdjsonReader } from './NdjsonReader';
import { NdjsonWriter } from './NdjsonWriter';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-ndjson-roundtrip-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface RawMessage {
  seq: number;
  id: string;
  from: string;
  body: string;
  timestamp: number;
}

/** Deterministically builds the record for a given sequence number. */
function makeRecord(seq: number): RawMessage {
  return {
    seq,
    id: `msg_${seq}`,
    from: seq % 2 === 0 ? 'me' : 'أحمد',
    body: `Message ${seq} — مرحبا 👋 ${'x'.repeat(seq % 17)}`,
    timestamp: 1_700_000_000 + seq,
  };
}

describe('NDJSON round-trip integrity (SC-002, SC-004, SC-007)', () => {
  it('round-trips 10,000+ records identically via streaming', async () => {
    const path = join(dir, 'messages.raw.ndjson');
    const total = 10_000;

    const writer = new NdjsonWriter(path);
    for (let seq = 0; seq < total; seq += 1) {
      await writer.writeRecord(makeRecord(seq));
    }
    await writer.close();

    // Sanity: the file is large enough that a full in-memory load would be
    // wasteful — the reader below streams instead of buffering the whole file.
    const { size } = await stat(path);
    expect(size).toBeGreaterThan(500_000);

    const reader = new NdjsonReader<RawMessage>(path);
    let count = 0;
    for await (const record of reader.read()) {
      // Compare against the regenerated expected record (no full-file array).
      expect(record).toEqual(makeRecord(count));
      count += 1;
    }

    expect(count).toBe(total);
    expect(reader.warnings).toHaveLength(0);
  }, 30_000);

  it('preserves raw immutability: re-reading yields the same records', async () => {
    const path = join(dir, 'messages.raw.ndjson');
    const total = 1_000;

    const writer = new NdjsonWriter(path);
    for (let seq = 0; seq < total; seq += 1) {
      await writer.writeRecord(makeRecord(seq));
    }
    await writer.close();

    const sizeAfterWrite = (await stat(path)).size;

    const firstPass: number[] = [];
    const reader = new NdjsonReader<RawMessage>(path);
    for await (const record of reader.read()) {
      firstPass.push(record.seq);
    }

    // Reading must never mutate the file (raw is immutable — FR-005, SC-007).
    expect((await stat(path)).size).toBe(sizeAfterWrite);
    expect(firstPass).toEqual(Array.from({ length: total }, (_, i) => i));
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NdjsonWriter } from './NdjsonWriter';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-ndjson-writer-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('NdjsonWriter (FR-007, FR-008)', () => {
  it('appends each record as one JSON object per line', async () => {
    const path = join(dir, 'messages.raw.ndjson');
    const writer = new NdjsonWriter(path);
    await writer.writeRecord({ id: 1, text: 'hello' });
    await writer.writeRecord({ id: 2, text: 'أهلاً' });
    await writer.close();

    const raw = await readFile(path, 'utf8');
    const lines = raw.split('\n');
    // Trailing newline produces a final empty element.
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('');
    expect(JSON.parse(lines[0] ?? '')).toEqual({ id: 1, text: 'hello' });
    expect(JSON.parse(lines[1] ?? '')).toEqual({ id: 2, text: 'أهلاً' });
  });

  it('serializes each record onto a single line', async () => {
    const path = join(dir, 'messages.raw.ndjson');
    const writer = new NdjsonWriter(path);
    await writer.writeRecord({ nested: { a: 1, b: [2, 3] }, multi: 'a\nb' });
    await writer.close();

    const raw = await readFile(path, 'utf8');
    // Exactly one data line: the embedded newline is JSON-escaped, not literal.
    expect(raw.split('\n').filter((l) => l.length > 0)).toHaveLength(1);
  });

  it('reopening and appending preserves prior lines', async () => {
    const path = join(dir, 'messages.raw.ndjson');

    const first = new NdjsonWriter(path);
    await first.writeRecord({ id: 1 });
    await first.close();

    const second = new NdjsonWriter(path);
    await second.writeRecord({ id: 2 });
    await second.close();

    const raw = await readFile(path, 'utf8');
    const lines = raw.split('\n').filter((l) => l.length > 0);
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('creates missing parent directories on first write', async () => {
    const path = join(dir, 'nested', 'raw', 'messages.raw.ndjson');
    const writer = new NdjsonWriter(path);
    await writer.writeRecord({ ok: true });
    await writer.close();

    const raw = await readFile(path, 'utf8');
    expect(JSON.parse(raw.trim())).toEqual({ ok: true });
  });

  it('close is idempotent and safe when nothing was written', async () => {
    const writer = new NdjsonWriter(join(dir, 'empty.ndjson'));
    await expect(writer.close()).resolves.toBeUndefined();
    await expect(writer.close()).resolves.toBeUndefined();
  });
});

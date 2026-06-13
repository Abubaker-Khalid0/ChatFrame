import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageError } from '../utils/errors';
import { NdjsonReader } from './NdjsonReader';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-ndjson-reader-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function collect<T>(reader: NdjsonReader<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const record of reader.read()) {
    out.push(record);
  }
  return out;
}

describe('NdjsonReader (FR-009, SC-004)', () => {
  it('streams one record at a time, preserving order', async () => {
    const path = join(dir, 'm.ndjson');
    await writeFile(path, '{"id":1}\n{"id":2}\n{"id":3}\n', 'utf8');

    const reader = new NdjsonReader<{ id: number }>(path);
    expect(await collect(reader)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(reader.warnings).toHaveLength(0);
  });

  it('tolerates blank lines between records', async () => {
    const path = join(dir, 'm.ndjson');
    await writeFile(path, '{"id":1}\n\n   \n{"id":2}\n', 'utf8');

    const reader = new NdjsonReader<{ id: number }>(path);
    expect(await collect(reader)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('reads a final line that lacks a trailing newline', async () => {
    const path = join(dir, 'm.ndjson');
    await writeFile(path, '{"id":1}\n{"id":2}', 'utf8');

    const reader = new NdjsonReader<{ id: number }>(path);
    expect(await collect(reader)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(reader.warnings).toHaveLength(0);
  });

  it('recovers complete lines and warns on a truncated final line', async () => {
    const path = join(dir, 'm.ndjson');
    // Two good records, then an interrupted write (no newline, invalid JSON).
    await writeFile(path, '{"id":1}\n{"id":2}\n', 'utf8');
    await appendFile(path, '{"id":3,"text":"par', 'utf8');

    const reader = new NdjsonReader<{ id: number }>(path);
    const records = await collect(reader);

    expect(records).toEqual([{ id: 1 }, { id: 2 }]);
    expect(reader.warnings).toHaveLength(1);
    expect(reader.warnings[0]?.code).toBe('TRUNCATED_FINAL_LINE');
  });

  it('throws on an unparseable line that is not the final line', async () => {
    const path = join(dir, 'm.ndjson');
    await writeFile(path, '{"id":1}\nnot-json\n{"id":3}\n', 'utf8');

    const reader = new NdjsonReader(path);
    await expect(collect(reader)).rejects.toBeInstanceOf(StorageError);
  });

  it('yields nothing for an empty file', async () => {
    const path = join(dir, 'm.ndjson');
    await writeFile(path, '', 'utf8');

    const reader = new NdjsonReader(path);
    expect(await collect(reader)).toEqual([]);
    expect(reader.warnings).toHaveLength(0);
  });
});

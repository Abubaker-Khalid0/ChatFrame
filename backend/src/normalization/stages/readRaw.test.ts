import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRawMessages, type RawReadEvent } from './readRaw';

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-readraw-'));
  path = join(dir, 'messages.raw.ndjson');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function collect(filePath: string): Promise<RawReadEvent[]> {
  const events: RawReadEvent[] = [];
  for await (const event of readRawMessages(filePath)) {
    events.push(event);
  }
  return events;
}

const validLine = (id: string): string =>
  JSON.stringify({
    id,
    chatId: 'chat-1',
    fromMe: false,
    author: 'contact-1',
    timestamp: 1_780_000_000,
    type: 'chat',
    body: 'hi',
    hasMedia: false,
  });

describe('readRawMessages (FR-001)', () => {
  it('streams and validates each line', async () => {
    await writeFile(path, `${validLine('m1')}\n${validLine('m2')}\n`, 'utf8');
    const events = await collect(path);

    expect(events).toHaveLength(2);
    expect(events.every((e) => e.kind === 'message')).toBe(true);
    expect(events.map((e) => (e.kind === 'message' ? e.message.id : null))).toEqual(['m1', 'm2']);
  });

  it('warns on a malformed JSON line and continues', async () => {
    await writeFile(path, `${validLine('m1')}\nnot-json\n${validLine('m2')}\n`, 'utf8');
    const events = await collect(path);

    expect(events.map((e) => e.kind)).toEqual(['message', 'invalid', 'message']);
    const invalid = events[1];
    expect(invalid?.kind === 'invalid' && invalid.warning.code).toBe('INVALID_RAW_MESSAGE');
    expect(invalid?.kind === 'invalid' && invalid.lineNumber).toBe(2);
  });

  it('warns on a schema-invalid line (missing required field) and continues', async () => {
    const badSchema = JSON.stringify({ id: 'x', chatId: 'chat-1' }); // missing fields
    await writeFile(path, `${badSchema}\n${validLine('m2')}\n`, 'utf8');
    const events = await collect(path);

    expect(events.map((e) => e.kind)).toEqual(['invalid', 'message']);
    const invalid = events[0];
    expect(invalid?.kind === 'invalid' && invalid.warning.code).toBe('INVALID_RAW_MESSAGE');
  });

  it('ignores blank lines', async () => {
    await writeFile(path, `\n${validLine('m1')}\n\n`, 'utf8');
    const events = await collect(path);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind === 'message' && events[0].lineNumber).toBe(2);
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RawWhatsAppMessageSchema, type RawWhatsAppMessage } from '@chatframe/shared';
import { MessageFetcher } from './MessageFetcher';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chatframe-fetcher-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function message(id: string): RawWhatsAppMessage {
  return {
    id,
    chatId: 'chat-1@c.us',
    fromMe: false,
    author: 'contact-001',
    timestamp: 1_780_000_000,
    type: 'chat',
    body: `body of ${id}`,
    hasMedia: false,
  };
}

async function* streamOf(messages: RawWhatsAppMessage[]): AsyncIterable<RawWhatsAppMessage> {
  for (const item of messages) {
    yield item;
  }
}

describe('MessageFetcher (FR-004, FR-005)', () => {
  it('writes one valid NDJSON line per streamed message', async () => {
    const rawPath = join(dir, 'raw', 'messages.raw.ndjson');
    const input = [message('raw-001'), message('raw-002'), message('raw-003')];

    const result = await new MessageFetcher({ rawPath }).run(streamOf(input));

    expect(result).toEqual({ count: 3, cancelled: false });
    const lines = (await readFile(rawPath, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(3);
    const parsed = lines.map((line) => RawWhatsAppMessageSchema.parse(JSON.parse(line)));
    expect(parsed.map((m) => m.id)).toEqual(['raw-001', 'raw-002', 'raw-003']);
  });

  it('invokes the count callback once per record with the running count', async () => {
    const rawPath = join(dir, 'raw', 'messages.raw.ndjson');
    const onMessage = vi.fn();

    await new MessageFetcher({ rawPath, onMessage }).run(
      streamOf([message('raw-001'), message('raw-002')]),
    );

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(1, 1, expect.objectContaining({ id: 'raw-001' }));
    expect(onMessage).toHaveBeenNthCalledWith(2, 2, expect.objectContaining({ id: 'raw-002' }));
  });

  it('stops at the cancel boundary, preserving already-written records', async () => {
    const rawPath = join(dir, 'raw', 'messages.raw.ndjson');
    let written = 0;
    const fetcher = new MessageFetcher({
      rawPath,
      onMessage: (count) => {
        written = count;
      },
      // Cancellation arrives after the second record is written.
      isCancelRequested: () => written >= 2,
    });

    const result = await fetcher.run(
      streamOf([message('raw-001'), message('raw-002'), message('raw-003'), message('raw-004')]),
    );

    expect(result).toEqual({ count: 2, cancelled: true });
    const lines = (await readFile(rawPath, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('creates an empty raw file for an empty stream (edge case)', async () => {
    const rawPath = join(dir, 'raw', 'messages.raw.ndjson');

    const result = await new MessageFetcher({ rawPath }).run(streamOf([]));

    expect(result).toEqual({ count: 0, cancelled: false });
    expect(await readFile(rawPath, 'utf8')).toBe('');
  });
});

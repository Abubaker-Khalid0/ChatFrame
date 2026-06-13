import { describe, expect, it } from 'vitest';
import { RenderModelSchema, type NormalizedMessage, type Participant } from '@chatframe/shared';
import { buildRenderModel } from './RenderModelBuilder';

function msg(
  overrides: Partial<NormalizedMessage> & Pick<NormalizedMessage, 'id'>,
): NormalizedMessage {
  return {
    chatId: 'chat-1',
    senderId: 'contact-1',
    isFromMe: false,
    type: 'text',
    timestampIso: '2026-06-07T09:00:00.000Z',
    dateKey: '2026-06-07',
    ...overrides,
  };
}

const opts = { projectId: 'p1', chatId: 'chat-1', participants: [] as Participant[] };

describe('RenderModelBuilder (FR-013, US5)', () => {
  it('produces a schema-valid render model', () => {
    const model = buildRenderModel([msg({ id: 'a', body: 'hi' })], opts);
    expect(() => RenderModelSchema.parse(model)).not.toThrow();
    expect(model.projectId).toBe('p1');
    expect(model.chatId).toBe('chat-1');
  });

  it('inserts a date separator before the first message of each day', () => {
    const model = buildRenderModel(
      [
        msg({ id: 'a', dateKey: '2026-06-07', timestampIso: '2026-06-07T09:00:00.000Z' }),
        msg({ id: 'b', dateKey: '2026-06-07', timestampIso: '2026-06-07T10:00:00.000Z' }),
        msg({ id: 'c', dateKey: '2026-06-08', timestampIso: '2026-06-08T08:00:00.000Z' }),
      ],
      opts,
    );

    const kinds = model.entries.map((e) =>
      e.kind === 'date-separator' ? `sep:${e.dateKey}` : e.id,
    );
    expect(kinds).toEqual(['sep:2026-06-07', 'a', 'b', 'sep:2026-06-08', 'c']);
  });

  it('sets direction from isFromMe', () => {
    const model = buildRenderModel(
      [msg({ id: 'a', isFromMe: true }), msg({ id: 'b', isFromMe: false })],
      opts,
    );
    const rows = model.entries.filter((e) => e.kind === 'message');
    expect(rows[0]).toMatchObject({ id: 'a', direction: 'sent' });
    expect(rows[1]).toMatchObject({ id: 'b', direction: 'received' });
  });

  it('includes unsupported messages as message entries', () => {
    const model = buildRenderModel(
      [msg({ id: 'a', type: 'unsupported', unsupported: { originalType: 'audio', reason: 'x' } })],
      opts,
    );
    const row = model.entries.find((e) => e.kind === 'message');
    expect(row).toMatchObject({
      id: 'a',
      type: 'unsupported',
      unsupported: { originalType: 'audio' },
    });
  });

  it('includes missing-image messages as message entries', () => {
    const model = buildRenderModel(
      [
        msg({
          id: 'a',
          type: 'image',
          image: {
            mediaId: 'img-1',
            localPath: 'media/images/img_000001.jpg',
            exportPath: 'assets/media/img_000001.jpg',
            missing: true,
          },
        }),
      ],
      opts,
    );
    const row = model.entries.find((e) => e.kind === 'message');
    expect(row).toMatchObject({ id: 'a', type: 'image', image: { missing: true } });
  });

  it('counts only message entries in totalMessages', () => {
    const model = buildRenderModel(
      [
        msg({ id: 'a', dateKey: '2026-06-07' }),
        msg({ id: 'b', dateKey: '2026-06-08', timestampIso: '2026-06-08T09:00:00.000Z' }),
      ],
      opts,
    );
    // 2 messages + 2 separators = 4 entries, but totalMessages === 2.
    expect(model.entries).toHaveLength(4);
    expect(model.totalMessages).toBe(2);
  });

  it('attaches injected participants', () => {
    const participants: Participant[] = [
      { id: 'me', displayName: 'Me', isMe: true },
      { id: 'contact-1', displayName: 'Ahmed', isMe: false },
    ];
    const model = buildRenderModel([msg({ id: 'a' })], { ...opts, participants });
    expect(model.participants).toEqual(participants);
  });

  it('handles an empty conversation with a valid (empty) model', () => {
    const model = buildRenderModel([], opts);
    expect(model.entries).toEqual([]);
    expect(model.totalMessages).toBe(0);
    expect(model.chatId).toBe('chat-1');
    expect(() => RenderModelSchema.parse(model)).not.toThrow();
  });
});

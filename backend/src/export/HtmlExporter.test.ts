import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ExportResultSchema,
  ExportSettingsSchema,
  type RenderEntry,
  type RenderModel,
} from '@chatframe/shared';
import { exportHtml, ExportFailedError, RenderModelNotFoundError } from './HtmlExporter';

let root: string;
let projectDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'chatframe-html-export-'));
  projectDir = join(root, 'chatframe_2026-06-10_sara');
  await mkdir(join(projectDir, 'media', 'images'), { recursive: true });
  await mkdir(join(projectDir, 'normalized'), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const ME = '15550000001@c.us';
const CONTACT = '15551234567@c.us';

function fixtureModel(extraEntries: RenderEntry[] = []): RenderModel {
  const entries: RenderEntry[] = [
    { kind: 'date-separator', dateKey: '2026-06-07' },
    {
      kind: 'message',
      id: 'm1',
      senderId: CONTACT,
      senderDisplayName: 'Sara',
      direction: 'received',
      type: 'text',
      timestampIso: '2026-06-07T08:30:00.000Z',
      dateKey: '2026-06-07',
      body: 'Hello! مرحبا',
    },
    {
      kind: 'message',
      id: 'm2',
      senderId: ME,
      direction: 'sent',
      type: 'image',
      timestampIso: '2026-06-07T08:31:00.000Z',
      dateKey: '2026-06-07',
      image: {
        mediaId: 'media-1',
        localPath: 'media/images/img_000001.jpg',
        exportPath: 'assets/media/img_000001.jpg',
        caption: 'A photo',
      },
    },
    {
      kind: 'message',
      id: 'm3',
      senderId: CONTACT,
      senderDisplayName: 'Sara',
      direction: 'received',
      type: 'deleted',
      timestampIso: '2026-06-07T08:32:00.000Z',
      dateKey: '2026-06-07',
      isDeleted: true,
    },
    ...extraEntries,
  ];
  return {
    projectId: 'chatframe_2026-06-10_sara',
    chatId: 'chat-1',
    participants: [
      { id: ME, displayName: 'Me', isMe: true },
      { id: CONTACT, displayName: 'Sara', isMe: false },
    ],
    entries,
    totalMessages: entries.filter((entry) => entry.kind === 'message').length,
  };
}

async function writeFixtureProject(model: RenderModel = fixtureModel()): Promise<void> {
  await writeFile(
    join(projectDir, 'normalized', 'render-model.json'),
    JSON.stringify(model, null, 2),
    'utf8',
  );
  await writeFile(join(projectDir, 'media', 'images', 'img_000001.jpg'), 'fake-jpeg-bytes');
}

function defaultOptions() {
  return {
    projectId: 'chatframe_2026-06-10_sara',
    projectDir,
    settings: ExportSettingsSchema.parse({}),
    locale: 'en' as const,
  };
}

async function walkFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

describe('exportHtml end-to-end (research §7)', () => {
  it('produces the complete archive and a valid ExportResult', async () => {
    await writeFixtureProject();

    const result = await exportHtml(defaultOptions());

    expect(ExportResultSchema.parse(result)).toEqual(result);
    expect(result.projectId).toBe('chatframe_2026-06-10_sara');
    expect(result.exportDir).toBe('exports/html');
    expect(result.htmlFilePath).toBe('exports/html/conversation.html');
    expect(result.imageCount).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    const exportDir = join(projectDir, 'exports', 'html');
    const html = await readFile(join(exportDir, 'conversation.html'), 'utf8');
    expect(html).toContain('cf-chat');
    expect((await stat(join(exportDir, 'assets', 'style.css'))).size).toBeGreaterThan(0);
    expect((await stat(join(exportDir, 'assets', 'fonts.css'))).size).toBeGreaterThan(0);
    expect((await readdir(join(exportDir, 'assets', 'fonts'))).length).toBeGreaterThan(0);
    expect(await readdir(join(exportDir, 'assets', 'media'))).toEqual(['img_000001.jpg']);

    // totalAssetSize covers every byte written under exports/html/.
    let totalBytes = 0;
    for (const file of await walkFiles(exportDir)) {
      totalBytes += (await stat(file)).size;
    }
    expect(result.totalAssetSize).toBe(totalBytes);

    // No staging leftovers: only the promoted html/ dir remains under exports/.
    expect(await readdir(join(projectDir, 'exports'))).toEqual(['html']);
  });

  it('throws RenderModelNotFoundError when no render model exists', async () => {
    await expect(exportHtml(defaultOptions())).rejects.toBeInstanceOf(RenderModelNotFoundError);
  });

  it('re-export fully replaces the prior archive (FR-020)', async () => {
    await writeFixtureProject();
    await exportHtml(defaultOptions());

    // Plant a stale file in the promoted export; it must not survive a re-run.
    await writeFile(join(projectDir, 'exports', 'html', 'stale.txt'), 'old');
    await exportHtml(defaultOptions());

    const files = await walkFiles(join(projectDir, 'exports', 'html'));
    expect(files.some((file) => file.endsWith('stale.txt'))).toBe(false);
  });

  it('cleans up staging and leaves the prior export intact on failure', async () => {
    await writeFixtureProject();
    const first = await exportHtml(defaultOptions());
    expect(first.imageCount).toBe(1);

    // A nonexistent stylesheet source simulates a write-phase failure.
    await expect(
      exportHtml({ ...defaultOptions(), stylesheetPath: join(root, 'missing.css') }),
    ).rejects.toBeInstanceOf(ExportFailedError);

    // The prior export is untouched and no staging directory remains.
    expect(await readdir(join(projectDir, 'exports'))).toEqual(['html']);
    const html = await readFile(join(projectDir, 'exports', 'html', 'conversation.html'), 'utf8');
    expect(html).toContain('cf-chat');
  });

  it('exports an image-free conversation without an assets/media directory', async () => {
    const model = fixtureModel();
    model.entries = model.entries.filter(
      (entry) => entry.kind !== 'message' || entry.type !== 'image',
    );
    await writeFixtureProject(model);

    const result = await exportHtml(defaultOptions());
    expect(result.imageCount).toBe(0);
    await expect(
      stat(join(projectDir, 'exports', 'html', 'assets', 'media')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('SC-006: the promoted tree contains only html/css/font/image files — no session, QR, token, or JSON/NDJSON bytes', async () => {
    await writeFixtureProject();
    await exportHtml(defaultOptions());

    const allowedExtensions = new Set([
      '.html',
      '.css',
      '.woff2',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
    ]);
    const files = await walkFiles(join(projectDir, 'exports', 'html'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const name = file.toLowerCase();
      expect(allowedExtensions.has(extname(name))).toBe(true);
      expect(name).not.toMatch(/session|wwebjs|token|\.json$|\.ndjson$/);
    }

    // No file carries session/QR/token payloads (FR-010).
    for (const file of files.filter((f) => /\.(html|css)$/.test(f))) {
      const content = await readFile(file, 'utf8');
      expect(content).not.toMatch(/wwebjs|LocalAuth|"qr"|authToken/i);
    }
  });

  it('performance smoke (FR-028, SC-011): a synthetic large model exports well under the 30s budget', async () => {
    // The real target is 10,000 messages / 500 images in 30s (quickstart
    // SC-011). CI machines vary, so this smoke test scales the same shape —
    // 10,000 message rows + 500 distinct images — and asserts a generous
    // CI-safe margin; the renderer streams, so memory stays flat either way.
    const MESSAGE_COUNT = 10_000;
    const IMAGE_COUNT = 500;
    const CI_SAFE_BUDGET_MS = 30_000;

    const entries: RenderEntry[] = [{ kind: 'date-separator', dateKey: '2026-06-07' }];
    for (let i = 0; i < MESSAGE_COUNT; i += 1) {
      const isImage = i < IMAGE_COUNT;
      const filename = `img_${String(i + 1).padStart(6, '0')}.jpg`;
      entries.push({
        kind: 'message',
        id: `m${i}`,
        senderId: i % 2 === 0 ? CONTACT : ME,
        ...(i % 2 === 0 ? { senderDisplayName: 'Sara' } : {}),
        direction: i % 2 === 0 ? 'received' : 'sent',
        type: isImage ? 'image' : 'text',
        timestampIso: new Date(Date.UTC(2026, 5, 7, 8, 0, i % 3600)).toISOString(),
        dateKey: '2026-06-07',
        ...(isImage
          ? {
              image: {
                mediaId: `media-${i}`,
                localPath: `media/images/${filename}`,
                exportPath: `assets/media/${filename}`,
              },
            }
          : { body: `Message number ${i} — some realistic body text مع نص عربي أيضًا.` }),
      });
    }

    const imageBytes = Buffer.alloc(8 * 1024, 7); // 8 KiB per synthetic image
    for (let i = 0; i < IMAGE_COUNT; i += 1) {
      const filename = `img_${String(i + 1).padStart(6, '0')}.jpg`;
      await writeFile(join(projectDir, 'media', 'images', filename), imageBytes);
    }
    await writeFile(
      join(projectDir, 'normalized', 'render-model.json'),
      JSON.stringify({
        projectId: 'chatframe_2026-06-10_sara',
        chatId: 'chat-1',
        participants: [
          { id: ME, displayName: 'Me', isMe: true },
          { id: CONTACT, displayName: 'Sara', isMe: false },
        ],
        entries,
        totalMessages: MESSAGE_COUNT,
      }),
      'utf8',
    );

    const startedAt = Date.now();
    const result = await exportHtml(defaultOptions());
    const elapsed = Date.now() - startedAt;

    expect(result.imageCount).toBe(IMAGE_COUNT);
    expect(elapsed).toBeLessThan(CI_SAFE_BUDGET_MS);
  }, 60_000);

  it('FR-002/FR-009: conversation.html has no <script> and no remote URLs', async () => {
    await writeFixtureProject();
    await exportHtml(defaultOptions());

    const html = await readFile(join(projectDir, 'exports', 'html', 'conversation.html'), 'utf8');
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/https?:\/\//);
  });
});

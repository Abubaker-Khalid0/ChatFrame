import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RenderEntry, RenderModel } from '@chatframe/shared';
import { CHAT_RENDERER_CSS_PATH, copyExportAssets } from './copyExportAssets';
import { EXPORT_FONT_FILES } from './fontAssets';

let root: string;
let projectDir: string;
let exportRoot: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'chatframe-export-assets-'));
  projectDir = join(root, 'project');
  exportRoot = join(root, 'staging');
  await mkdir(join(projectDir, 'media', 'images'), { recursive: true });
  await mkdir(exportRoot, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function imageRow(
  id: string,
  filename: string,
  missing = false,
): Extract<RenderEntry, { kind: 'message' }> {
  return {
    kind: 'message',
    id,
    senderId: 'contact@c.us',
    direction: 'received',
    type: 'image',
    timestampIso: '2026-06-07T08:30:00.000Z',
    dateKey: '2026-06-07',
    image: {
      mediaId: `media-${id}`,
      localPath: `media/images/${filename}`,
      exportPath: `assets/media/${filename}`,
      ...(missing ? { missing: true } : {}),
    },
  };
}

function modelWith(entries: RenderEntry[]): RenderModel {
  return {
    projectId: 'proj-1',
    chatId: 'chat-1',
    participants: [],
    entries,
    totalMessages: entries.length,
  };
}

describe('copyExportAssets (research §6)', () => {
  it('copies chat-renderer.css byte-identically to assets/style.css (SC-008)', async () => {
    await copyExportAssets({ projectDir, exportRoot, model: modelWith([]) });

    const source = await readFile(CHAT_RENDERER_CSS_PATH);
    const copied = await readFile(join(exportRoot, 'assets', 'style.css'));
    expect(copied.equals(source)).toBe(true);
  });

  it('writes fonts.css and copies every bundled font file into assets/fonts/', async () => {
    await copyExportAssets({ projectDir, exportRoot, model: modelWith([]) });

    const fontsCss = await readFile(join(exportRoot, 'assets', 'fonts.css'), 'utf8');
    expect(fontsCss).toContain('@font-face');

    const fontFiles = await readdir(join(exportRoot, 'assets', 'fonts'));
    expect(fontFiles.sort()).toEqual(EXPORT_FONT_FILES.map((f) => f.filename).sort());
    for (const file of fontFiles) {
      expect((await stat(join(exportRoot, 'assets', 'fonts', file))).size).toBeGreaterThan(0);
    }
  });

  it('copies referenced images with preserved filenames and reports counts/sizes', async () => {
    await writeFile(join(projectDir, 'media', 'images', 'img_000001.jpg'), 'fake-jpeg-bytes-1');
    await writeFile(join(projectDir, 'media', 'images', 'img_000002.png'), 'fake-png-bytes-22');

    const result = await copyExportAssets({
      projectDir,
      exportRoot,
      model: modelWith([
        imageRow('m1', 'img_000001.jpg'),
        imageRow('m2', 'img_000002.png'),
        // The same asset referenced twice is copied once.
        imageRow('m3', 'img_000001.jpg'),
      ]),
    });

    expect(result.imageCount).toBe(2);
    const copied1 = await readFile(join(exportRoot, 'assets', 'media', 'img_000001.jpg'), 'utf8');
    expect(copied1).toBe('fake-jpeg-bytes-1');
    const mediaFiles = await readdir(join(exportRoot, 'assets', 'media'));
    expect(mediaFiles.sort()).toEqual(['img_000001.jpg', 'img_000002.png']);
  });

  it('skips assets recorded as missing and sources that no longer exist', async () => {
    await writeFile(join(projectDir, 'media', 'images', 'img_000001.jpg'), 'present');

    const result = await copyExportAssets({
      projectDir,
      exportRoot,
      model: modelWith([
        imageRow('m1', 'img_000001.jpg'),
        imageRow('m2', 'img_000002.jpg', true), // missing flag → skipped
        imageRow('m3', 'img_000003.jpg'), // file absent on disk → skipped
      ]),
    });

    expect(result.imageCount).toBe(1);
    const mediaFiles = await readdir(join(exportRoot, 'assets', 'media'));
    expect(mediaFiles).toEqual(['img_000001.jpg']);
  });

  it('produces no assets/media directory for an image-free conversation', async () => {
    await copyExportAssets({ projectDir, exportRoot, model: modelWith([]) });
    await expect(stat(join(exportRoot, 'assets', 'media'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('totalAssetSize equals the byte sum of every file written under the export root', async () => {
    await writeFile(join(projectDir, 'media', 'images', 'img_000001.jpg'), 'fake-jpeg-bytes-1');

    const result = await copyExportAssets({
      projectDir,
      exportRoot,
      model: modelWith([imageRow('m1', 'img_000001.jpg')]),
    });

    let expected = 0;
    async function walk(dir: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(path);
        } else {
          expected += (await stat(path)).size;
        }
      }
    }
    await walk(exportRoot);
    expect(result.totalAssetSize).toBe(expected);
    expect(result.totalAssetSize).toBeGreaterThan(0);
  });
});

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MediaAssetSchema } from '@chatframe/shared';
import { z } from 'zod';
import { readJson } from './JsonFile';
import { MediaStore } from './MediaStore';

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'chatframe-media-'));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

const indexPath = (): string => join(projectDir, 'normalized', 'media.json');
const imagesDir = (): string => join(projectDir, 'media', 'images');

describe('MediaStore (FR-013)', () => {
  it('saves bytes that round-trip identically on retrieval', async () => {
    const store = new MediaStore(projectDir);
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02, 0x03]);

    const asset = await store.saveImage('wamid.ABC', bytes, 'image/jpeg');
    expect(asset.missing).toBe(false);
    expect(asset.sizeBytes).toBe(bytes.length);

    const retrieved = await store.getImage('wamid.ABC');
    expect(retrieved).not.toBeNull();
    expect(Buffer.compare(retrieved as Buffer, bytes)).toBe(0);
  });

  it('uses zero-padded sequential names with a mime-derived extension', async () => {
    const store = new MediaStore(projectDir);
    const first = await store.saveImage('a', Buffer.from('a'), 'image/jpeg');
    const second = await store.saveImage('b', Buffer.from('b'), 'image/png');

    expect(first.filename).toBe('img_000001.jpg');
    expect(second.filename).toBe('img_000002.png');
  });

  it('continues sequential numbering from existing files on disk', async () => {
    await mkdir(imagesDir(), { recursive: true });
    await writeFile(join(imagesDir(), 'img_000003.jpg'), Buffer.from('old'));

    const store = new MediaStore(projectDir);
    const asset = await store.saveImage('new', Buffer.from('new'), 'image/webp');
    expect(asset.filename).toBe('img_000004.webp');
  });

  it('records a failed download as missing without writing a file', async () => {
    const store = new MediaStore(projectDir);
    const asset = await store.recordMissing('wamid.FAIL', 'image/jpeg');

    expect(asset.missing).toBe(true);
    expect(asset.filename).toBe('img_000001.jpg');
    expect(await store.getImage('wamid.FAIL')).toBeNull();

    // The asset is still tracked in the index (no silent data loss).
    const tracked = await store.getAsset('wamid.FAIL');
    expect(tracked?.missing).toBe(true);
  });

  it('persists a schema-valid media index', async () => {
    const store = new MediaStore(projectDir);
    await store.saveImage('a', Buffer.from('a'), 'image/jpeg');
    await store.recordMissing('b', 'image/png');

    const index = await readJson(indexPath(), z.array(MediaAssetSchema));
    expect(index).toHaveLength(2);
    expect(index.map((asset) => asset.mediaId)).toEqual(['a', 'b']);
  });

  it('replaces an existing asset when the same mediaId is saved again', async () => {
    const store = new MediaStore(projectDir);
    await store.recordMissing('a', 'image/jpeg');
    await store.saveImage('a', Buffer.from('recovered'), 'image/jpeg');

    const index = await store.readIndex();
    expect(index).toHaveLength(1);
    expect(index[0]?.missing).toBe(false);

    const retrieved = await store.getImage('a');
    expect(retrieved?.toString()).toBe('recovered');
  });

  it('returns null for an untracked mediaId', async () => {
    const store = new MediaStore(projectDir);
    expect(await store.getImage('nope')).toBeNull();
    expect(await store.getAsset('nope')).toBeUndefined();
  });
});

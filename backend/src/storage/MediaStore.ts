import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { MediaAssetSchema, type MediaAsset } from '@chatframe/shared';
import { readJson, writeJson } from './JsonFile';

/**
 * Stores downloaded images and tracks their metadata (FR-013; research §7).
 *
 * Images are written to `media/images/` with zero-padded sequential filenames
 * (`img_000001.jpg`, `img_000002.png`, …). The next counter is derived by
 * scanning the existing files (and reserved index entries) so imports resume
 * cleanly. Every asset — including a failed download recorded as `missing` — is
 * tracked in a validated `normalized/media.json` index (Constitution XXIII — no
 * silent data loss).
 */

/** The on-disk media index is a flat array of {@link MediaAsset}. */
const MediaIndexSchema = z.array(MediaAssetSchema);

/** Width of the zero-padded sequence number (supports up to 999,999 images). */
const COUNTER_WIDTH = 6;

/** Maps common image MIME types to file extensions (research §7). */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
};

/** Derives a file extension from a MIME type, defaulting to `bin` when unknown. */
function extensionFor(mimeType?: string): string {
  if (!mimeType) {
    return 'bin';
  }
  const normalized = mimeType.toLowerCase();
  const mapped = MIME_EXTENSIONS[normalized];
  if (mapped) {
    return mapped;
  }
  const subtype = normalized.split('/')[1];
  const cleaned = subtype?.replace(/[^a-z0-9]/g, '');
  return cleaned && cleaned.length > 0 ? cleaned : 'bin';
}

/** Extracts the numeric sequence from a `img_000123.ext` filename, or 0. */
function sequenceOf(filename: string): number {
  const match = /^img_(\d+)\./.exec(filename);
  return match ? Number.parseInt(match[1] ?? '', 10) : 0;
}

export class MediaStore {
  private readonly imagesDir: string;
  private readonly indexPath: string;

  constructor(projectDir: string) {
    this.imagesDir = join(projectDir, 'media', 'images');
    this.indexPath = join(projectDir, 'normalized', 'media.json');
  }

  /** Reads and validates the media index, treating a missing file as empty. */
  async readIndex(): Promise<MediaAsset[]> {
    try {
      return await readJson(this.indexPath, MediaIndexSchema);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /** Returns the tracked asset for `mediaId`, or `undefined` if untracked. */
  async getAsset(mediaId: string): Promise<MediaAsset | undefined> {
    const index = await this.readIndex();
    return index.find((asset) => asset.mediaId === mediaId);
  }

  /**
   * Returns the stored image bytes for `mediaId`, or `null` when the asset is
   * untracked or was recorded as missing.
   */
  async getImage(mediaId: string): Promise<Buffer | null> {
    const asset = await this.getAsset(mediaId);
    if (!asset || asset.missing) {
      return null;
    }
    return readFile(join(this.imagesDir, asset.filename));
  }

  /**
   * Saves image bytes under the next sequential filename and records the asset
   * in the index. Re-saving an existing `mediaId` replaces its entry.
   */
  async saveImage(mediaId: string, bytes: Buffer, mimeType?: string): Promise<MediaAsset> {
    const filename = await this.nextFilename(mimeType);
    await mkdir(this.imagesDir, { recursive: true });
    await writeFile(join(this.imagesDir, filename), bytes);

    const asset: MediaAsset = {
      mediaId,
      filename,
      missing: false,
      sizeBytes: bytes.length,
      ...(mimeType ? { mimeType } : {}),
    };
    await this.upsert(asset);
    return asset;
  }

  /**
   * Records a failed download as a `missing` asset. A sequential filename is
   * still reserved so ordering stays deterministic, but no file is written
   * (FR-013, Constitution XXIII).
   */
  async recordMissing(mediaId: string, mimeType?: string): Promise<MediaAsset> {
    const filename = await this.nextFilename(mimeType);
    const asset: MediaAsset = {
      mediaId,
      filename,
      missing: true,
      ...(mimeType ? { mimeType } : {}),
    };
    await this.upsert(asset);
    return asset;
  }

  /** Computes the next zero-padded sequential filename for `mimeType`. */
  private async nextFilename(mimeType?: string): Promise<string> {
    const counter = await this.nextCounter();
    const padded = String(counter).padStart(COUNTER_WIDTH, '0');
    return `img_${padded}.${extensionFor(mimeType)}`;
  }

  /** Next counter = 1 + the highest sequence seen on disk or in the index. */
  private async nextCounter(): Promise<number> {
    let onDisk: string[] = [];
    try {
      onDisk = await readdir(this.imagesDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    const index = await this.readIndex();
    const sequences = [
      ...onDisk.map(sequenceOf),
      ...index.map((asset) => sequenceOf(asset.filename)),
    ];
    return Math.max(0, ...sequences) + 1;
  }

  /** Inserts or replaces an asset (keyed by `mediaId`) and persists the index. */
  private async upsert(asset: MediaAsset): Promise<void> {
    const index = await this.readIndex();
    const next = index.filter((existing) => existing.mediaId !== asset.mediaId);
    next.push(asset);
    await writeJson(this.indexPath, MediaIndexSchema, next);
  }
}

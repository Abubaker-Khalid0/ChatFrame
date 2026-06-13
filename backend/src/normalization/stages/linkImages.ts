import type { ImageMetadata, MediaAsset } from '@chatframe/shared';
import type { MappedMessage, NormalizationMetrics } from '../types';

/**
 * Image linking (FR-008, FR-012, FR-019, research §7).
 *
 * Links each `image` message to its downloaded file using the `MediaStore`
 * index (`normalized/media.json`). A present asset sets `image.localPath` /
 * `image.exportPath` with `missing: false`. An absent or failed-download asset
 * sets `missing: true`, keeps the message visible as a placeholder, and
 * increments `metrics.missingImages` (Constitution XXIII — no silent loss).
 * `media.json` itself is owned by `MediaStore` and is read, not rewritten.
 *
 * Operates on the in-memory media index (passed in by the pipeline, which reads
 * it once) so the stage stays pure and testable without the filesystem.
 */

/** Relative path (POSIX) to a stored image within the project folder. */
function localPathFor(filename: string): string {
  return `media/images/${filename}`;
}

/** Relative path (POSIX) to an image within an HTML export's assets folder. */
function exportPathFor(filename: string): string {
  return `assets/media/${filename}`;
}

/** Builds the `ImageMetadata` for one image message against its asset. */
function buildImageMetadata(
  mediaId: string,
  asset: MediaAsset | undefined,
  caption: string | undefined,
): { image: ImageMetadata; missing: boolean } {
  const present = asset !== undefined && !asset.missing;
  // A tracked asset (even a failed one) carries a reserved filename; an
  // untracked reference falls back to the mediaId as a placeholder name.
  const filename = asset?.filename ?? mediaId;

  const image: ImageMetadata = {
    mediaId,
    localPath: localPathFor(filename),
    exportPath: exportPathFor(filename),
    missing: !present,
    ...(asset?.mimeType !== undefined ? { mimeType: asset.mimeType } : {}),
    ...(present && asset?.sizeBytes !== undefined ? { sizeBytes: asset.sizeBytes } : {}),
    ...(caption !== undefined && caption.length > 0 ? { caption } : {}),
  };

  return { image, missing: !present };
}

/**
 * Links image messages to media assets in place, incrementing
 * `metrics.missingImages` for each unavailable image. Returns the same array.
 */
export function linkImages(
  items: MappedMessage[],
  metrics: NormalizationMetrics,
  mediaIndex: MediaAsset[],
): MappedMessage[] {
  const byId = new Map<string, MediaAsset>(mediaIndex.map((asset) => [asset.mediaId, asset]));

  for (const item of items) {
    if (item.message.type !== 'image') {
      continue;
    }
    // An image without a media reference cannot be located; keep it visible as
    // a missing placeholder keyed by the message id.
    const mediaId = item.rawMediaId ?? item.message.id;
    const asset = item.rawMediaId !== undefined ? byId.get(item.rawMediaId) : undefined;

    const { image, missing } = buildImageMetadata(mediaId, asset, item.rawCaption);
    item.message.image = image;
    if (missing) {
      metrics.missingImages += 1;
    }
  }

  return items;
}

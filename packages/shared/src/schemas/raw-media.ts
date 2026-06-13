import { z } from 'zod';

/**
 * `RawMediaMetadata` — one line per image in the immutable
 * `raw/media.raw.ndjson` provenance log (007 FR-007; data-model §7).
 *
 * Distinct from the normalized `MediaAsset` index (`normalized/media.json`)
 * that `MediaStore` owns: this records what the adapter reported per media id,
 * append-only and never rewritten (Constitution VI). It is not consumed by
 * normalization — it exists for provenance and "no silent data loss" of media
 * outcomes (Constitution XXIII).
 */
export const RawMediaMetadataSchema = z.object({
  /** Source media id from the message. */
  mediaId: z.string().min(1),
  /** Owning raw message id. */
  messageId: z.string().min(1),
  /** Project-relative saved path (e.g. `media/images/img_000001.jpg`). */
  localPath: z.string().min(1),
  /** Original MIME type as reported by the adapter. */
  mimeType: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Saved file size, or 0 when missing. */
  sizeBytes: z.number().int().nonnegative(),
  /** `true` when all retries were exhausted (FR-012, FR-027). */
  missing: z.boolean(),
});
export type RawMediaMetadata = z.infer<typeof RawMediaMetadataSchema>;

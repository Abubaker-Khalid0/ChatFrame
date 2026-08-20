import type { RawMediaMetadata, RawWhatsAppMessage } from '@chatframe/shared';
import { NdjsonWriter } from '../storage/NdjsonWriter';
import type { MediaStore } from '../storage/MediaStore';
import type { WhatsAppAdapter } from '../whatsapp/WhatsAppAdapter';
import { DEFAULT_CONCURRENCY, runWithConcurrency } from './concurrency';
import { DEFAULT_RETRY_DELAYS_MS, retryWithBackoff } from './retry';

/**
 * Downloads the images of streamed messages through the adapter
 * (FR-006, FR-007, FR-012; research §3, §4).
 *
 * Downloads run in parallel with a bounded pool (≤5, FR-028); each one is
 * retried with exponential backoff (3×: 1s/2s/4s, FR-027). A download that
 * exhausts its retries does NOT fail the import: the asset is recorded as
 * missing via `MediaStore.recordMissing`, a warning is emitted, and the run
 * continues (Constitution XXIII — no silent data loss). Every outcome is also
 * appended to the immutable `raw/media.raw.ndjson` provenance log
 * (Constitution VI).
 *
 * Robustness (Phase 10 hardening):
 * - Zero-byte downloads are treated as failures: some adapters return an empty
 *   buffer instead of null when media has expired. These are retried and, if
 *   still empty after retries, recorded as missing with a specific warning.
 * - Download timeout detection: individual downloads that hang beyond
 *   {@link DOWNLOAD_TIMEOUT_MS} are aborted, preventing a single stuck request
 *   from blocking the entire pool indefinitely.
 * - Each download outcome is recorded in the provenance log regardless of
 *   success/failure, providing a complete audit trail of what was attempted.
 */

export interface ImageDownloadWarning {
  code: string;
  message: string;
  messageId?: string;
}

/** Per-download timeout in milliseconds (60 seconds, generous for large images). */
const DOWNLOAD_TIMEOUT_MS = 60_000;

export interface ImageDownloaderOptions {
  adapter: Pick<WhatsAppAdapter, 'downloadImage'>;
  mediaStore: MediaStore;
  /** Absolute path of `raw/media.raw.ndjson`. */
  rawMediaPath: string;
  /** Maximum parallel downloads (default 5, FR-028). */
  concurrency?: number;
  /** Retry schedule before an image is declared missing (FR-027). */
  retryDelaysMs?: readonly number[];
  /** Injectable delay for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Per-download timeout in milliseconds (default 60s). */
  downloadTimeoutMs?: number;
  /** Progress callback: images settled so far out of the known total. */
  onImage?: (downloaded: number, total: number) => void;
  /** Non-fatal issue reporting (FR-012, FR-016). */
  onWarning?: (warning: ImageDownloadWarning) => void;
  /** Cooperative cancellation token, polled before each download. */
  isCancelRequested?: () => boolean;
}

export interface ImageDownloaderResult {
  /** Images saved successfully. */
  downloaded: number;
  /** Images recorded as missing after retry exhaustion. */
  missing: number;
  /** Media-bearing messages considered. */
  total: number;
  /** Whether the run stopped early because cancellation was requested. */
  cancelled: boolean;
}

export class ImageDownloader {
  private readonly options: ImageDownloaderOptions;
  /** Serializes MediaStore index writes; downloads stay parallel. */
  private storeQueue: Promise<unknown> = Promise.resolve();

  constructor(options: ImageDownloaderOptions) {
    this.options = options;
  }

  /** Downloads all media-bearing messages, settling every item. */
  async run(messages: readonly RawWhatsAppMessage[]): Promise<ImageDownloaderResult> {
    const items = messages.filter(
      (message) => message.hasMedia && message.mediaId !== undefined && message.type === 'image',
    );
    const total = items.length;
    let downloaded = 0;
    let missing = 0;
    let cancelled = false;

    if (total === 0) {
      return { downloaded, missing, total, cancelled };
    }

    const writer = new NdjsonWriter(this.options.rawMediaPath);
    try {
      await runWithConcurrency(
        items,
        this.options.concurrency ?? DEFAULT_CONCURRENCY,
        async (message) => {
          if (cancelled || this.options.isCancelRequested?.()) {
            cancelled = true;
            return;
          }
          const outcome = await this.downloadOne(message, writer);
          if (outcome === 'downloaded') {
            downloaded += 1;
          } else {
            missing += 1;
          }
          this.options.onImage?.(downloaded, total);
        },
      );
    } finally {
      await writer.close();
    }

    return { downloaded, missing, total, cancelled };
  }

  /** Downloads one image with retries; failures settle as `missing`. */
  private async downloadOne(
    message: RawWhatsAppMessage,
    writer: NdjsonWriter,
  ): Promise<'downloaded' | 'missing'> {
    const mediaId = message.mediaId as string;
    try {
      const media = await retryWithBackoff(
        async () => {
          const result = await this.withTimeout(
            this.options.adapter.downloadImage(message),
            this.options.downloadTimeoutMs ?? DOWNLOAD_TIMEOUT_MS,
          );
          if (result === null) {
            throw new Error('Media unavailable');
          }
          // Treat zero-byte buffers as failed downloads — some adapters return
          // empty buffers when media has expired on WhatsApp servers.
          if (result.buffer.length === 0) {
            throw new Error('Media returned empty buffer');
          }
          return result;
        },
        {
          delaysMs: this.options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS,
          ...(this.options.sleep ? { sleep: this.options.sleep } : {}),
        },
      );

      if (media.mimeType !== '' && !media.mimeType.toLowerCase().startsWith('image/')) {
        // Saved as-is — surfaced as a non-fatal finding (FR-016).
        this.options.onWarning?.({
          code: 'UNEXPECTED_MIME_TYPE',
          message: `Media reported an unexpected type '${media.mimeType}'; saved as-is.`,
          messageId: message.id,
        });
      }

      const asset = await this.enqueueStoreOp(() =>
        this.options.mediaStore.saveImage(mediaId, media.buffer, media.mimeType),
      );
      await writer.writeRecord(
        this.rawMetadata(message, mediaId, {
          localPath: `media/images/${asset.filename}`,
          ...(media.mimeType ? { mimeType: media.mimeType } : {}),
          sizeBytes: media.buffer.length,
          missing: false,
        }),
      );
      return 'downloaded';
    } catch {
      // Retries exhausted: record the gap, warn, and continue (FR-012).
      const asset = await this.enqueueStoreOp(() => this.options.mediaStore.recordMissing(mediaId));
      await writer.writeRecord(
        this.rawMetadata(message, mediaId, {
          localPath: `media/images/${asset.filename}`,
          sizeBytes: 0,
          missing: true,
        }),
      );
      this.options.onWarning?.({
        code: 'IMAGE_DOWNLOAD_FAILED',
        message: 'Image unavailable after 3 retries; marked missing.',
        messageId: message.id,
      });
      return 'missing';
    }
  }

  /**
   * Wraps a promise with a timeout. If the download hangs beyond the specified
   * duration, the returned promise rejects so the retry loop can attempt again
   * or declare the media missing — preventing a single stuck request from
   * blocking the entire pool.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    if (timeoutMs <= 0 || !Number.isFinite(timeoutMs)) return promise;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Download timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private rawMetadata(
    message: RawWhatsAppMessage,
    mediaId: string,
    rest: Omit<RawMediaMetadata, 'mediaId' | 'messageId'>,
  ): RawMediaMetadata {
    return { mediaId, messageId: message.id, ...rest };
  }

  /**
   * MediaStore's index updates are read-modify-write; running them in
   * parallel would race the sequential filename counter and the index file,
   * so store operations are chained while downloads remain concurrent.
   */
  private enqueueStoreOp<T>(op: () => Promise<T>): Promise<T> {
    const next = this.storeQueue.then(op, op);
    this.storeQueue = next.catch(() => undefined);
    return next;
  }
}

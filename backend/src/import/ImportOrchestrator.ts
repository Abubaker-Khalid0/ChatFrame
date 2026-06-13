import type {
  ImportProgress,
  ImportStage,
  ProjectManifest,
  RawWhatsAppMessage,
  StartImportRequest,
} from '@chatframe/shared';
import { eventManager, type EventManager } from '../api/sse/eventManager';
import { env } from '../config/env';
import { PROJECTS_DIR } from '../config/paths';
import { runNormalizationPipeline } from '../normalization/NormalizationPipeline';
import { readManifest, writeManifest } from '../projects/ProjectManifest';
import {
  importLogPath,
  projectDirPath,
  rawMediaPath,
  rawMessagesPath,
} from '../projects/ProjectPaths';
import { createProject } from '../projects/ProjectStore';
import { MediaStore } from '../storage/MediaStore';
import { ExportError, MediaDownloadError, NormalizationError, StorageError } from '../utils/errors';
import { SessionExpiredError, WhatsAppNotConnectedError } from '../whatsapp/errors';
import type { WhatsAppAdapter } from '../whatsapp/WhatsAppAdapter';
import { ImageDownloader } from './ImageDownloader';
import { ImportLogger } from './importLogger';
import { MessageFetcher } from './MessageFetcher';
import * as importRegistry from './importRegistry';

/**
 * Drives the full import pipeline (FR-001; data-model §1, §8):
 *
 * `preparing_project → fetching_metadata → fetching_messages →
 * saving_raw_messages → [downloading_images] → normalizing →
 * resolving_replies → generating_quality_report → preparing_preview →
 * completed`, with `failed`/`cancelled` off-ramps.
 *
 * The orchestrator owns stage transitions, progress throttling (FR-029),
 * cooperative cancellation at safe boundaries (research §7), fatal-error
 * mapping to user-safe codes (US5), the sanitized `import.log`, and the
 * `project.json` status record. Every attempt creates a fresh project folder
 * (FR-030); raw files written along the way are never rewritten
 * (Constitution VI).
 */

/** Emit a throttled progress event every N items… (FR-029). */
export const PROGRESS_EVERY_ITEMS = 50;
/** …or every N milliseconds, whichever comes first (FR-029). */
export const PROGRESS_EVERY_MS = 2_000;

/**
 * Normalization steps that advance the visible import stage (research §6).
 * Unlisted steps keep the current stage; the mapping never moves backwards.
 */
const STEP_STAGE_MAP: Readonly<Record<string, ImportStage>> = {
  resolveReplies: 'resolving_replies',
  qualityReport: 'generating_quality_report',
  promote: 'preparing_preview',
};

/** Canonical stage order used to keep mapped transitions monotonic. */
const STAGE_ORDER: readonly ImportStage[] = [
  'preparing_project',
  'fetching_metadata',
  'fetching_messages',
  'saving_raw_messages',
  'downloading_images',
  'normalizing',
  'resolving_replies',
  'generating_quality_report',
  'preparing_preview',
  'completed',
  'failed',
  'cancelled',
];

function stageRank(stage: ImportStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/** Internal: a failure already mapped to a user-safe code + message. */
class ImportFatalError extends Error {
  readonly code: string;
  readonly causeError: unknown;

  constructor(code: string, userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = 'ImportFatalError';
    this.code = code;
    this.causeError = cause;
  }
}

/**
 * Maps a pipeline failure to a user-safe error code and message (US5 AC-3,
 * Constitution XIX). Raw error internals (stack traces, tokens, library
 * messages) never reach the user.
 *
 * Covers the fatal subset of the 8 error categories (010 data-model §1.3):
 * connection, session expiry, storage, media, normalization, export, and the
 * generic import fallback. Unsupported message types are never fatal — they
 * are preserved as placeholders by the normalization pipeline (Constitution
 * XXIII) and surface as quality warnings, not errors.
 */
function classifyError(error: unknown): { code: string; message: string } {
  if (error instanceof ImportFatalError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof SessionExpiredError) {
    return {
      code: 'SESSION_EXPIRED',
      message: 'Your WhatsApp session expired during import. Scan the QR code and try again.',
    };
  }
  if (error instanceof WhatsAppNotConnectedError) {
    return {
      code: 'SESSION_DISCONNECTED',
      message: 'The WhatsApp session was lost during import. Reconnect and try again.',
    };
  }
  if (error instanceof MediaDownloadError) {
    return {
      code: 'MEDIA_DOWNLOAD_ERROR',
      message: 'Some images could not be downloaded. They will appear as placeholders.',
    };
  }
  if (error instanceof NormalizationError) {
    return {
      code: 'NORMALIZATION_ERROR',
      message: 'Message processing encountered an error. Raw data is preserved.',
    };
  }
  if (error instanceof ExportError) {
    return {
      code: 'EXPORT_ERROR',
      message: 'The export could not be completed. Check disk space and try again.',
    };
  }
  if (error instanceof StorageError) {
    return {
      code: 'STORAGE_ERROR',
      message: 'A storage error occurred while saving import data.',
    };
  }
  return {
    code: 'ADAPTER_ERROR',
    message: 'The import failed unexpectedly. Any data fetched so far is preserved.',
  };
}

export interface StartImportOptions {
  request: StartImportRequest;
  adapter: WhatsAppAdapter;
  /** Directory that holds all project folders. Defaults to {@link PROJECTS_DIR}. */
  projectsDir?: string;
  /** Event sink. Defaults to the process-wide SSE {@link eventManager}. */
  events?: Pick<EventManager, 'broadcast'>;
  /** Clock injection for deterministic timestamps and throttling. */
  now?: () => Date;
  /** Adapter name recorded in `source.json`. */
  adapterName?: string;
  /** Image download tuning (tests inject zero delays / lower limits). */
  downloadConcurrency?: number;
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Progress throttle tuning (FR-029). */
  progressEveryItems?: number;
  progressEveryMs?: number;
}

export interface ImportRunHandle {
  importId: string;
  projectId: string;
  startedAt: string;
  /** Settles with the terminal progress snapshot; never rejects (US5). */
  done: Promise<ImportProgress>;
}

/**
 * Claims the single import slot, creates a fresh project folder (FR-030), and
 * starts the pipeline in the background. Throws `ImportInProgressError` when
 * an import is active (FR-017) and propagates project-creation failures; once
 * a handle is returned, all subsequent outcomes are delivered through
 * progress/terminal events and the resolved `done` promise.
 */
export async function startImport(options: StartImportOptions): Promise<ImportRunHandle> {
  const now = options.now ?? (() => new Date());
  const projectsDir = options.projectsDir ?? PROJECTS_DIR;
  const events = options.events ?? eventManager;
  const startedAtDate = now();
  const importId = `imp_${startedAtDate.getTime()}_${Math.random().toString(36).slice(2, 8)}`;

  importRegistry.start(importId);

  let projectId: string;
  try {
    const created = await createProject(
      {
        chatId: options.request.chatId,
        chatDisplayName: options.request.chatDisplayName ?? null,
        chatPhoneNumber: options.request.chatPhoneNumber ?? null,
        adapter: options.adapterName ?? (env.MOCK_MODE ? 'mock' : 'whatsapp-web.js'),
      },
      { projectsDir, now: startedAtDate },
    );
    projectId = created.projectId;
  } catch (error) {
    importRegistry.clear();
    throw error;
  }

  const startedAt = startedAtDate.toISOString();
  const initial: ImportProgress = {
    importId,
    projectId,
    stage: 'preparing_project',
    messagesImported: 0,
    imagesDownloaded: 0,
    warnings: [],
    startedAt,
  };
  importRegistry.update(initial);
  events.broadcast('import.progress', initial);

  const done = runPipeline({ options, events, now, projectsDir, importId, projectId, initial });
  return { importId, projectId, startedAt, done };
}

interface PipelineContext {
  options: StartImportOptions;
  events: Pick<EventManager, 'broadcast'>;
  now: () => Date;
  projectsDir: string;
  importId: string;
  projectId: string;
  initial: ImportProgress;
}

/** Counter + timestamp throttle: every N items or N ms (research §2). */
function createThrottle(ctx: PipelineContext): { shouldEmit(): boolean } {
  const everyItems = ctx.options.progressEveryItems ?? PROGRESS_EVERY_ITEMS;
  const everyMs = ctx.options.progressEveryMs ?? PROGRESS_EVERY_MS;
  let sinceEmit = 0;
  let lastEmitMs = ctx.now().getTime();
  return {
    shouldEmit(): boolean {
      sinceEmit += 1;
      const nowMs = ctx.now().getTime();
      if (sinceEmit >= everyItems || nowMs - lastEmitMs >= everyMs) {
        sinceEmit = 0;
        lastEmitMs = nowMs;
        return true;
      }
      return false;
    },
  };
}

/** Runs the pipeline to a terminal stage. Resolves — never rejects. */
async function runPipeline(ctx: PipelineContext): Promise<ImportProgress> {
  const { options, events, now, importId, projectId } = ctx;
  const projectDir = projectDirPath(projectId, ctx.projectsDir);
  const logger = new ImportLogger(importLogPath(projectDir));
  const startedMs = now().getTime();
  let progress = ctx.initial;

  const update = (next: ImportProgress): void => {
    progress = next;
    importRegistry.update(progress);
  };
  const emit = (): void => {
    events.broadcast('import.progress', progress);
  };
  const logStage = (): void => {
    logger.logStage({
      stage: progress.stage,
      messagesImported: progress.messagesImported,
      imagesDownloaded: progress.imagesDownloaded,
      warnings: progress.warnings.length,
      elapsedMs: now().getTime() - startedMs,
    });
  };
  // A stage transition always emits a progress event immediately (FR-029).
  const setStage = (stage: ImportStage): void => {
    update({ ...progress, stage });
    emit();
    logStage();
  };
  const warn = (code: string, message: string, messageId?: string): void => {
    update({ ...progress, warnings: [...progress.warnings, message] });
    events.broadcast('import.warning', {
      importId,
      code,
      message,
      ...(messageId !== undefined ? { messageId } : {}),
    });
    logger.logEvent({ event: 'warning', code, ...(messageId !== undefined ? { messageId } : {}) });
  };
  const isCancelRequested = (): boolean => importRegistry.isCancelRequested();

  const patchManifest = async (patch: Partial<ProjectManifest>): Promise<void> => {
    const manifest = await readManifest(projectDir);
    await writeManifest(projectDir, { ...manifest, ...patch });
  };

  /** Shared terminal bookkeeping: snapshot, events, log, registry release. */
  const finalize = (stage: 'completed' | 'failed' | 'cancelled', completedAt: string): void => {
    update({ ...progress, stage, completedAt });
    emit();
    events.broadcast('import.completed', progress);
    logStage();
    importRegistry.clear();
  };

  const finalizeCompleted = async (): Promise<ImportProgress> => {
    const completedAt = now().toISOString();
    // Manifest first: a failure here must fail the import, not mask it.
    await patchManifest({
      status: 'imported',
      importedAt: completedAt,
      messageCount: progress.messagesImported,
      imageCount: progress.imagesDownloaded,
    });
    logger.logEvent({ event: 'import_completed' });
    finalize('completed', completedAt);
    return progress;
  };

  const finalizeCancelled = async (): Promise<ImportProgress> => {
    // Partial raw data is preserved; the folder records the outcome (US4 AC-3).
    await patchManifest({
      status: 'cancelled',
      messageCount: progress.messagesImported,
      imageCount: progress.imagesDownloaded,
    }).catch(() => undefined);
    logger.logEvent({ event: 'import_cancelled' });
    finalize('cancelled', now().toISOString());
    return progress;
  };

  const finalizeFailed = async (error: unknown): Promise<ImportProgress> => {
    const { code, message } = classifyError(error);
    events.broadcast('import.error', { importId, code, message });
    logger.logEvent({ event: 'import_failed', code });
    await patchManifest({ status: 'error' }).catch(() => undefined);
    finalize('failed', now().toISOString());
    return progress;
  };

  try {
    await patchManifest({ status: 'importing' });
    setStage('fetching_metadata');
    if (isCancelRequested()) return await finalizeCancelled();

    // Stream messages to the immutable raw NDJSON (FR-004, FR-005).
    setStage('fetching_messages');
    const mediaMessages: RawWhatsAppMessage[] = [];
    const fetchThrottle = createThrottle(ctx);
    const fetcher = new MessageFetcher({
      rawPath: rawMessagesPath(projectDir),
      isCancelRequested,
      onMessage: (count, message) => {
        if (message.hasMedia && message.mediaId !== undefined && message.type === 'image') {
          mediaMessages.push(message);
        }
        update({ ...progress, messagesImported: count });
        if (fetchThrottle.shouldEmit()) {
          emit();
        }
      },
    });
    const fetchResult = await fetcher.run(
      options.adapter.fetchMessages(options.request.chatId, {}),
    );
    update({
      ...progress,
      messagesImported: fetchResult.count,
      // The streaming adapter reports no total; once the stream is fully
      // consumed, the count IS the total (positive-only per the schema).
      ...(fetchResult.count > 0 && !fetchResult.cancelled
        ? { messagesTotal: fetchResult.count }
        : {}),
    });
    setStage('saving_raw_messages');
    if (fetchResult.cancelled || isCancelRequested()) return await finalizeCancelled();

    // Optional image stage — skipped entirely for text-only imports (US2 AC-5).
    if (options.request.options.includeImages) {
      setStage('downloading_images');
      if (mediaMessages.length > 0) {
        update({ ...progress, imagesTotal: mediaMessages.length });
        emit();
      }
      const downloadThrottle = createThrottle(ctx);
      const downloader = new ImageDownloader({
        adapter: options.adapter,
        mediaStore: new MediaStore(projectDir),
        rawMediaPath: rawMediaPath(projectDir),
        ...(options.downloadConcurrency !== undefined
          ? { concurrency: options.downloadConcurrency }
          : {}),
        ...(options.retryDelaysMs !== undefined ? { retryDelaysMs: options.retryDelaysMs } : {}),
        ...(options.sleep !== undefined ? { sleep: options.sleep } : {}),
        isCancelRequested,
        onImage: (downloaded) => {
          update({ ...progress, imagesDownloaded: downloaded });
          if (downloadThrottle.shouldEmit()) {
            emit();
          }
        },
        onWarning: (warning) => warn(warning.code, warning.message, warning.messageId),
      });
      const downloadResult = await downloader.run(mediaMessages);
      update({ ...progress, imagesDownloaded: downloadResult.downloaded });
      if (downloadResult.cancelled || isCancelRequested()) return await finalizeCancelled();
    }

    // Pre-normalization cancel boundary (research §7).
    if (isCancelRequested()) return await finalizeCancelled();

    // Edge case: an empty conversation completes immediately with empty
    // counts — there is nothing to normalize.
    if (progress.messagesImported === 0) {
      return await finalizeCompleted();
    }

    // Reuse the Phase 4 pipeline unchanged (FR-008, FR-009; research §6).
    setStage('normalizing');
    let metricsWarnings: { code: string; message: string; messageId?: string | undefined }[] = [];
    try {
      const metrics = await runNormalizationPipeline({
        projectDir,
        projectId,
        now,
        onStep: (step) => {
          const target = STEP_STAGE_MAP[step];
          if (target !== undefined && stageRank(target) > stageRank(progress.stage)) {
            setStage(target);
          }
        },
      });
      metricsWarnings = metrics.warnings;
    } catch (error) {
      throw new ImportFatalError(
        'NORMALIZATION_FAILED',
        'Normalization failed. Imported raw data is preserved.',
        error,
      );
    }

    // Surface non-fatal normalization findings (e.g. INVALID_RAW_LINE) as
    // import warnings too (FR-016); they also live in the quality report.
    for (const warning of metricsWarnings) {
      warn(warning.code, warning.message, warning.messageId);
    }

    return await finalizeCompleted();
  } catch (error) {
    return await finalizeFailed(error);
  }
}

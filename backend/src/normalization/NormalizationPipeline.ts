import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { QualityReportSchema, RenderModelSchema, ParticipantListSchema } from '@chatframe/shared';
import { NdjsonWriter } from '../storage/NdjsonWriter';
import { writeJson } from '../storage/JsonFile';
import { MediaStore } from '../storage/MediaStore';
import { normalizedMessagesPath, rawMessagesPath } from '../projects/ProjectPaths';
import { cleanupStaging, createStagingDir, promoteStaging } from './atomicStaging';
import { NormalizationLogger } from './NormalizationLogger';
import { buildQualityReport, hasFatalError } from './QualityReportBuilder';
import { buildRenderModel } from './RenderModelBuilder';
import { classifyUnsupported } from './stages/classifyUnsupported';
import { deduplicate } from './stages/deduplicate';
import { linkImages } from './stages/linkImages';
import { mapMessage } from './stages/mapMessage';
import { readRawMessages } from './stages/readRaw';
import { resolveParticipants } from './stages/resolveParticipants';
import { resolveReplies } from './stages/resolveReplies';
import { sortMessages } from './stages/sortMessages';
import { createMetrics, type MappedMessage, type NormalizationMetrics } from './types';

/**
 * Normalization pipeline orchestrator (FR-014, FR-021, FR-022).
 *
 * Phase 3 (US1) wires the first stages: read raw → map + normalize timestamps →
 * classify unsupported → sort → write `messages.ndjson`. Outputs are written to
 * a per-run staging directory and atomically promoted into `normalized/` only
 * on full success; any failure cleans up staging and leaves `normalized/`
 * untouched (FR-021). Later stages (dedup, replies, participants, images,
 * quality report, render model) plug in here in subsequent phases.
 */

export interface RunPipelineOptions {
  /** Absolute path to the project folder. */
  projectDir: string;
  /** Project id (folder name), used for output identity in later stages. */
  projectId: string;
  /** Reports the current stage name (for run-status visibility). */
  onStep?: (step: string) => void;
  /** Clock injection for deterministic run ids / "now". */
  now?: () => Date;
}

/** Builds a filesystem-safe, per-run staging id (not part of any output). */
function buildRunId(startedAt: Date): string {
  return `${startedAt.toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
}

/**
 * Runs the normalization pipeline for a project, returning the metrics
 * accumulator. Throws on fatal IO errors (the caller/run-registry records the
 * failure); staging is always cleaned up on failure.
 */
export async function runNormalizationPipeline(
  options: RunPipelineOptions,
): Promise<NormalizationMetrics> {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const nowMs = startedAt.getTime();
  const runId = buildRunId(startedAt);

  const logger = new NormalizationLogger(join(options.projectDir, 'logs', 'normalization.log'));
  const metrics = createMetrics();
  const step = (name: string): void => options.onStep?.(name);

  const stagingDir = await createStagingDir(options.projectDir, runId);

  try {
    // Stage 1: read raw + map + normalize timestamps (streamed).
    step('readRaw');
    const readStart = Date.now();
    const mapped: MappedMessage[] = [];
    let fileIndex = 0;
    let fallbackMs = nowMs;

    for await (const event of readRawMessages(rawMessagesPath(options.projectDir))) {
      metrics.totalRawMessages += 1;
      if (event.kind === 'invalid') {
        metrics.warnings.push(event.warning);
        continue;
      }
      const result = mapMessage(event.message, { fileIndex, fallbackMs, nowMs });
      metrics.warnings.push(...result.warnings);
      fallbackMs = result.epochMs;
      mapped.push(result.mapped);
      fileIndex += 1;
    }
    logger.logStep({
      step: 'readRaw',
      inputCount: metrics.totalRawMessages,
      outputCount: mapped.length,
      durationMs: Date.now() - readStart,
      warnings: metrics.warnings.length,
    });

    // Stage 2: classify unsupported types (preserve, never drop).
    step('classifyUnsupported');
    const classifyStart = Date.now();
    classifyUnsupported(mapped, metrics);
    logger.logStep({
      step: 'classifyUnsupported',
      inputCount: mapped.length,
      outputCount: mapped.length,
      durationMs: Date.now() - classifyStart,
      warnings: metrics.warnings.length,
    });

    // Stage 3: stable chronological sort.
    step('sortMessages');
    const sortStart = Date.now();
    const sorted = sortMessages(mapped);
    logger.logStep({
      step: 'sortMessages',
      inputCount: mapped.length,
      outputCount: sorted.length,
      durationMs: Date.now() - sortStart,
      warnings: metrics.warnings.length,
    });

    // Stage 4: deduplicate by id (most-complete record wins).
    step('deduplicate');
    const dedupStart = Date.now();
    const deduped = deduplicate(sorted, metrics);
    metrics.totalNormalizedMessages = deduped.length;
    if (deduped.length > 0) {
      metrics.dateFrom = deduped[0]?.message.timestampIso ?? null;
      metrics.dateTo = deduped[deduped.length - 1]?.message.timestampIso ?? null;
    }
    logger.logStep({
      step: 'deduplicate',
      inputCount: sorted.length,
      outputCount: deduped.length,
      durationMs: Date.now() - dedupStart,
      warnings: metrics.warnings.length,
    });

    // Stage 5: resolve reply references (best-effort) against the final set.
    step('resolveReplies');
    const replyStart = Date.now();
    const resolved = resolveReplies(deduped, metrics);
    logger.logStep({
      step: 'resolveReplies',
      inputCount: resolved.length,
      outputCount: resolved.length,
      durationMs: Date.now() - replyStart,
      warnings: metrics.warnings.length,
    });

    // Stage 6: link image messages to stored media (FR-008, FR-019). The media
    // index is owned by MediaStore; missing/untracked images become visible
    // placeholders and increment metrics.missingImages.
    step('linkImages');
    const linkStart = Date.now();
    const mediaIndex = await new MediaStore(options.projectDir).readIndex();
    linkImages(resolved, metrics, mediaIndex);
    logger.logStep({
      step: 'linkImages',
      inputCount: resolved.length,
      outputCount: resolved.length,
      durationMs: Date.now() - linkStart,
      warnings: metrics.warnings.length,
    });

    // Stage 7: write messages.ndjson into staging.
    step('writeMessages');
    const writeStart = Date.now();
    const stagedMessages = join(stagingDir, 'messages.ndjson');
    if (resolved.length === 0) {
      // Always produce the output file, even for an empty conversation.
      await writeFile(stagedMessages, '', 'utf8');
    } else {
      const writer = new NdjsonWriter(stagedMessages);
      for (const item of resolved) {
        await writer.writeRecord(item.message);
      }
      await writer.close();
    }
    logger.logStep({
      step: 'writeMessages',
      inputCount: resolved.length,
      outputCount: resolved.length,
      durationMs: Date.now() - writeStart,
      warnings: metrics.warnings.length,
    });

    // Stage 8: resolve participants (FR-011) and write participants.json.
    step('resolveParticipants');
    const participantsStart = Date.now();
    const participants = resolveParticipants(resolved);
    await writeJson(join(stagingDir, 'participants.json'), ParticipantListSchema, participants);
    logger.logStep({
      step: 'resolveParticipants',
      inputCount: resolved.length,
      outputCount: participants.length,
      durationMs: Date.now() - participantsStart,
      warnings: metrics.warnings.length,
    });

    // Stage 9: build + write the render model (FR-013) with resolved participants.
    step('renderModel');
    const renderStart = Date.now();
    const renderModel = buildRenderModel(
      resolved.map((item) => item.message),
      { projectId: options.projectId, chatId: options.projectId, participants },
    );
    await writeJson(join(stagingDir, 'render-model.json'), RenderModelSchema, renderModel);
    logger.logStep({
      step: 'renderModel',
      inputCount: resolved.length,
      outputCount: renderModel.totalMessages,
      durationMs: Date.now() - renderStart,
      warnings: metrics.warnings.length,
    });

    // Stage 10: build + write the quality report into staging (FR-010).
    step('qualityReport');
    const reportStart = Date.now();
    const report = buildQualityReport(metrics, { projectId: options.projectId, now });
    await writeJson(join(stagingDir, 'quality-report.json'), QualityReportSchema, report);
    logger.logStep({
      step: 'qualityReport',
      inputCount: resolved.length,
      outputCount: resolved.length,
      durationMs: Date.now() - reportStart,
      warnings: metrics.warnings.length,
    });

    // Promote staged outputs atomically.
    step('promote');
    await promoteStaging(options.projectDir, stagingDir);

    // A fatal data error (e.g. zero messages remaining) still produces a
    // promoted quality report, but the run is marked failed so the UI blocks
    // progression to export (FR-018, edge case).
    if (hasFatalError(report)) {
      throw new Error('Normalization completed with a fatal data error; see the quality report.');
    }

    return metrics;
  } catch (error) {
    await cleanupStaging(stagingDir).catch(() => undefined);
    throw error;
  }
}

/** Re-export the normalized output path helper for callers/tests. */
export { normalizedMessagesPath };
